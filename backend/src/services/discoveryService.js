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
 * Returns sorted discovery candidates (highest match_score first, then nearest).
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

module.exports = { getSortedDiscoveryCandidates };
