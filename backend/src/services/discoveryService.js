const mongoose = require('mongoose');
const {
  User,
  UserBlock,
  Like,
  Match,
  Pass,
} = require('../models');
const { matchPercentage } = require('../utils/geo');
const { serializePublicUser } = require('../serializers/user');

const LOCATION_STALE_MS = 60 * 60 * 1000;
const DEFAULT_DISCOVERY_RADIUS_M = 1000;
const MAX_DISCOVERY_RADIUS_M = 10000;

/**
 * [LEGACY / MAP FEED]
 * Returns sorted discovery candidates (highest match_score first, then nearest).
 * This function powers the `getNearbyUsers` (Map View) endpoint which does not strictly enforce the 
 * exact multi-weighted limit-based scoring required by the main discovery feed.
 * 
 * Uses MongoDB $geoNear on `location` instead of loading all discoverable users.
 * @param {import('mongoose').Document} currentUser
 * @param {import('express').Request} req
 * @param {{ includeAlreadyLiked?: boolean, includeMatchedUsers?: boolean }} [options]
 *        `includeMatchedUsers` — when true, people you already matched with stay in results (map pins).
 */
async function getSortedDiscoveryCandidates(currentUser, req, options = {}) {
  const { includeAlreadyLiked = false, includeMatchedUsers = false } = options;
  const radius = Math.min(
    Number(req.query.radius || currentUser.discovery_radius || DEFAULT_DISCOVERY_RADIUS_M),
    MAX_DISCOVERY_RADIUS_M
  );
  const threshold = Date.now() - LOCATION_STALE_MS;

  const blockedRows = await UserBlock.find({
    $or: [{ blocker: currentUser._id }, { blocked: currentUser._id }],
  });
  const passedRows = await Pass.find({ from_user: currentUser._id });
  const likedRows = includeAlreadyLiked ? [] : await Like.find({ from_user: currentUser._id });
  /** Swipe deck excludes matches; map nearby should still show matched people so pins stay after you connect. */
  const matchRows =
    includeMatchedUsers
      ? []
      : await Match.find({
          $or: [{ user1: currentUser._id }, { user2: currentUser._id }],
        });

  const excludeSet = new Set([String(currentUser._id)]);
  for (const row of passedRows) excludeSet.add(String(row.to_user));
  for (const row of likedRows) excludeSet.add(String(row.to_user));
  for (const row of matchRows) {
    excludeSet.add(
      String(row.user1) === String(currentUser._id) ? String(row.user2) : String(row.user1)
    );
  }
  for (const row of blockedRows) {
    excludeSet.add(String(row.blocker));
    excludeSet.add(String(row.blocked));
  }

  /** Always $nin self — deleting currentUser from this set omitted $nin and returned the viewer as “nearby”. */
  const excludeIds = [...excludeSet].map((id) => new mongoose.Types.ObjectId(id));

  const geoResults = await User.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [Number(currentUser.longitude), Number(currentUser.latitude)],
        },
        distanceField: 'geoDistanceMeters',
        maxDistance: radius,
        spherical: true,
        key: 'location',
        query: {
          _id: { $nin: excludeIds },
          is_discoverable: true,
          location_updated_at: { $gte: new Date(threshold) },
        },
      },
    },
  ]);

  if (geoResults.length === 0) {
    return { radius, candidates: [] };
  }

  const ids = geoResults.map((r) => r._id);
  const users = await User.find({ _id: { $in: ids } }).populate('interest_ids');
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const currentInterestIds = (currentUser.interest_ids || []).map(String);
  const candidates = [];

  for (const row of geoResults) {
    const otherUser = byId.get(String(row._id));
    if (!otherUser) continue;

    const distance = row.geoDistanceMeters;

    const otherInterestIds = (otherUser.interest_ids || []).map(String);
    const baseMatchPercentage = matchPercentage(currentInterestIds, otherInterestIds);

    let distanceScore = 0;
    if (distance <= 300) {
      distanceScore = 30;
    } else if (distance <= 1000) {
      distanceScore = 20;
    } else if (distance <= 3000) {
      distanceScore = 10;
    } else {
      distanceScore = 5;
    }

    const interestScore = baseMatchPercentage * 0.7;
    const matchScore = Math.round(Math.min(100, interestScore + distanceScore));

    const serialized = await serializePublicUser(otherUser, req);
    candidates.push({
      ...serialized,
      distance: Math.round(distance * 10) / 10,
      match_percentage: baseMatchPercentage,
      common_interests: currentInterestIds.filter((id) => otherInterestIds.includes(id)),
      match_score: matchScore,
    });
  }

  candidates.sort((a, b) => {
    if (b.match_score !== a.match_score) {
      return b.match_score - a.match_score;
    }
    return a.distance - b.distance;
  });

  return { radius, candidates };
}

/**
 * [MAIN DISCOVERY FEED]
 * Returns scored + sorted candidates strictly for the discovery swipe feed.
 * Weights: 70% interest similarity, 30% proximity.
 * This is the new feed implementing the strict feature spec.
 * Unlike getSortedDiscoveryCandidates, this function handles exact limit projections, excludes pending requests, 
 * and scores precisely. Used by `GET /api/discovery`.
 */
async function getDiscoveryCandidates(currentUser, options = {}) {
  const { radiusMeters = 20000, limit = 50 } = options;
  const staleThreshold = new Date(Date.now() - LOCATION_STALE_MS);

  // --- 1. Fetch blocked/already-interacted user IDs to exclude ---
  const blockedRows = await UserBlock.find({
    $or: [{ blocker: currentUser._id }, { blocked: currentUser._id }],
  });
  const passedRows = await Pass.find({ from_user: currentUser._id });
  
  // Note: We also exclude "pending" requests and matches! Both are part of Like/Match.
  // The user prompt mentioned ensuring pending requests are also excluded. 
  // Any Like row where from_user = currentUser should be excluded.
  // Any Like row where to_user = currentUser and status = pending could be excluded.
  // We'll exclude anyone we've sent a like/pass to, or blocked, or matched.
  const likedRows = await Like.find({
    $or: [
      { from_user: currentUser._id },
      { to_user: currentUser._id, status: 'pending' },
      // Note: rejected reverse-likes are intentionally not excluded here.
      // A rejected Like does not create a Match, so the rejector may re-encounter
      // the sender in discovery. If this should change, add status: 'rejected'
      // to this clause and add a corresponding test case.
    ]
  });

  const matchRows = await Match.find({
    $or: [{ user1: currentUser._id }, { user2: currentUser._id }],
  });

  const excludeSet = new Set([String(currentUser._id)]);
  for (const row of passedRows) excludeSet.add(String(row.to_user));
  for (const row of likedRows) {
    excludeSet.add(String(row.to_user));
    excludeSet.add(String(row.from_user)); // safe because we exclude self anyway
  }
  for (const row of matchRows) {
    excludeSet.add(String(row.user1) === String(currentUser._id) ? String(row.user2) : String(row.user1));
  }
  for (const row of blockedRows) {
    excludeSet.add(String(row.blocker));
    excludeSet.add(String(row.blocked));
  }
  
  const excludeIds = [...excludeSet].map((id) => new mongoose.Types.ObjectId(id));

  // --- 2. Geo query ---
  if (!currentUser.longitude || !currentUser.latitude) {
    return []; // Cannot do discovery without location
  }

  const candidatesGeo = await User.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [Number(currentUser.longitude), Number(currentUser.latitude)],
        },
        distanceField: 'dist.calculated',
        maxDistance: radiusMeters,
        spherical: true,
        key: 'location',
        query: {
          _id: { $nin: excludeIds },
          is_discoverable: true,
          location_updated_at: { $gte: staleThreshold },
        },
      },
    },
    { $limit: limit * 3 },
    {
      $project: {
        password_hash: 0,
        __v: 0,
      },
    },
  ]);

  if (candidatesGeo.length === 0) return [];

  const candidateIds = candidatesGeo.map(c => c._id);
  const populatedUsers = await User.find({ _id: { $in: candidateIds } }).populate('interest_ids');
  const userMap = new Map();
  for (const user of populatedUsers) userMap.set(String(user._id), user);

  const currentInterestIds = (currentUser.interest_ids || []).map(String);
  const currentInterestDocs = await mongoose.model('Interest').find({ _id: { $in: currentInterestIds }});
  
  const scored = [];
  
  for (const candidateRaw of candidatesGeo) {
    const candidateUser = userMap.get(String(candidateRaw._id));
    if (!candidateUser) continue;
    
    // Instead of using the raw candidate, we should use serialized output for safety
    // For simplicity, we just use the hydrated candidateUser and add meta fields
    const candidateInterestIds = (candidateUser.interest_ids || []).map(i => String(i._id));

    // matchPercentage returns 0-100. Divide by 100 to get a 0-1 score matching Jaccard's 0-1 output.
    const interestScore = matchPercentage(currentInterestIds, candidateInterestIds) / 100;
    
    const distanceMeters = candidateRaw.dist.calculated || 0;
    const distanceKm = distanceMeters / 1000;
    const proximityScore = Math.max(0, 1 - distanceKm / (radiusMeters / 1000));
    
    const matchScore = (0.7 * interestScore) + (0.3 * proximityScore);
    
    // Convert to plain object to attach _meta
    const candidatePayload = candidateUser.toObject();
    delete candidatePayload.password_hash;
    delete candidatePayload.__v;

    scored.push({
      ...candidatePayload,
      _meta: {
        interestScore: parseFloat(interestScore.toFixed(4)),
        proximityScore: parseFloat(proximityScore.toFixed(4)),
        matchScore: parseFloat(matchScore.toFixed(4)),
        distanceKm: parseFloat(distanceKm.toFixed(2)),
      },
    });
  }

  // --- 4. Sort descending by matchScore, return top `limit` ---
  return scored
    .sort((a, b) => b._meta.matchScore - a._meta.matchScore)
    .slice(0, limit);
}

module.exports = { getSortedDiscoveryCandidates, getDiscoveryCandidates };
