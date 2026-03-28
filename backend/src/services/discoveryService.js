const {
  User,
  UserBlock,
  Like,
  Match,
  Pass,
} = require('../models');
const { haversineDistance, matchPercentage } = require('../utils/geo');
const { serializePublicUser } = require('../serializers/user');

const LOCATION_STALE_MS = 60 * 60 * 1000;
const DEFAULT_DISCOVERY_RADIUS_M = 1000;
const MAX_DISCOVERY_RADIUS_M = 10000;

/**
 * Returns sorted discovery candidates (highest match_score first, then nearest).
 * @param {import('mongoose').Document} currentUser
 * @param {import('express').Request} req
 */
async function getSortedDiscoveryCandidates(currentUser, req) {
  const radius = Math.min(
    Number(req.query.radius || currentUser.discovery_radius || DEFAULT_DISCOVERY_RADIUS_M),
    MAX_DISCOVERY_RADIUS_M
  );
  const threshold = Date.now() - LOCATION_STALE_MS;

  const allUsers = await User.find({
    _id: { $ne: currentUser._id },
    is_discoverable: true,
    latitude: { $ne: null },
    longitude: { $ne: null },
    location_updated_at: { $ne: null },
  });

  const blockedRows = await UserBlock.find({
    $or: [{ blocker: currentUser._id }, { blocked: currentUser._id }],
  });
  const passedRows = await Pass.find({ from_user: currentUser._id });
  const likedRows = await Like.find({ from_user: currentUser._id });
  const matchRows = await Match.find({
    $or: [{ user1: currentUser._id }, { user2: currentUser._id }],
  });

  const passedSet = new Set(passedRows.map((row) => String(row.to_user)));
  const likedSet = new Set(likedRows.map((row) => String(row.to_user)));
  const matchedSet = new Set(
    matchRows.map((row) =>
      String(row.user1) === String(currentUser._id) ? String(row.user2) : String(row.user1)
    )
  );
  const blockedSet = new Set();
  for (const row of blockedRows) {
    blockedSet.add(String(row.blocker));
    blockedSet.add(String(row.blocked));
  }
  blockedSet.delete(String(currentUser._id));

  const currentInterestIds = (currentUser.interest_ids || []).map(String);
  const candidates = [];

  for (const otherUser of allUsers) {
    const otherId = String(otherUser._id);
    if (
      blockedSet.has(otherId) ||
      passedSet.has(otherId) ||
      likedSet.has(otherId) ||
      matchedSet.has(otherId)
    ) {
      continue;
    }
    if (!otherUser.location_updated_at || otherUser.location_updated_at.getTime() < threshold) {
      continue;
    }

    const distance = haversineDistance(
      Number(currentUser.latitude),
      Number(currentUser.longitude),
      Number(otherUser.latitude),
      Number(otherUser.longitude)
    );
    if (distance > radius) {
      continue;
    }

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
