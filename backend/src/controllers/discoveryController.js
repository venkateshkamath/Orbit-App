const { User, Like, Match, Pass } = require('../models');
const { serializePublicUser } = require('../serializers/user');
const { getSortedDiscoveryCandidates, getDiscoveryCandidates } = require('../services/discoveryService');
const { notifyOrbitJoinRecipient } = require('../services/notificationService');

// GET /api/discovery?radius=10000&limit=20
async function getDiscoveryFeed(req, res) {
  try {
    const radiusMeters = parseInt(req.query.radius, 10) || 20000;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const currentUser = await User.findById(req.user._id);
    if (!currentUser.location || !currentUser.location.coordinates || currentUser.location.coordinates.length < 2) {
      return res.status(400).json({
        error: 'Location not set. Please update your location first.',
      });
    }

    const candidates = await getDiscoveryCandidates(currentUser, { radiusMeters, limit });
    res.json({ count: candidates.length, users: candidates });
  } catch (err) {
    console.error('[getDiscoveryFeed]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// GET /api/discovery/nearby?radius=5000
async function getNearbyUsers(req, res) {
  try {
    const radiusMeters = Math.min(
      parseInt(req.query.radius, 10) || 5000,
      50000 // hard cap at 50 km
    );

    const currentUser = await User.findById(req.user._id);
    if (!currentUser.location || !currentUser.location.coordinates || currentUser.location.coordinates.length < 2) {
      return res.status(400).json({ error: 'Location not set.' });
    }

    const nearby = await User.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: currentUser.location.coordinates,
          },
          distanceField: 'distanceMeters',
          maxDistance: radiusMeters,
          spherical: true,
          query: { _id: { $ne: currentUser._id }, is_discoverable: true },
        },
      },
      { $limit: 100 },
      {
        $project: {
          username: 1,
          avatar: 1,
          interest_ids: 1,
          location: 1,
          distanceMeters: 1,
        },
      },
    ]);

    res.json({ count: nearby.length, users: nearby });
  } catch (err) {
    console.error('[getNearbyUsers]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function nearby(req, res) {
  const currentUser = await User.findById(req.user._id);
  if (currentUser.latitude === null || currentUser.longitude === null) {
    res.status(400).json({ error: 'Location not set. Please update your location first.' });
    return;
  }

  const { radius, candidates } = await getSortedDiscoveryCandidates(currentUser, req, {
    includeAlreadyLiked: true,
    includeMatchedUsers: true,
  });
  res.json({
    count: candidates.length,
    radius,
    users: candidates,
  });
}

async function next(req, res) {
  const currentUser = await User.findById(req.user._id);
  if (currentUser.latitude === null || currentUser.longitude === null) {
    res.status(400).json({ error: 'Location not set. Please update your location first.' });
    return;
  }

  const { radius, candidates } = await getSortedDiscoveryCandidates(currentUser, req);
  res.json({
    radius,
    user: candidates[0] || null,
  });
}

async function likeUser(req, res) {
  const toUser = await User.findById(req.params.userId);
  if (!toUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  if (String(toUser._id) === String(req.user._id)) {
    res.status(400).json({ error: 'Cannot like yourself' });
    return;
  }

  const existingLike = await Like.findOne({
    from_user: req.user._id,
    to_user: toUser._id,
  });
  if (existingLike) {
    res.json({ message: 'Already liked', is_match: false, match: null });
    return;
  }

  await Like.create({
    from_user: req.user._id,
    to_user: toUser._id,
  });

  const actorUser = await User.findById(req.user._id);

  const mutualLike = await Like.findOne({
    from_user: toUser._id,
    to_user: req.user._id,
  });

  if (!mutualLike && actorUser) {
    await notifyOrbitJoinRecipient(toUser._id, actorUser);
  }

  let match = null;
  if (mutualLike) {
    const sortedIds = [String(req.user._id), String(toUser._id)].sort();
    let matchRow = await Match.findOne({
      user1: sortedIds[0],
      user2: sortedIds[1],
    });
    if (!matchRow) {
      matchRow = await Match.create({
        user1: sortedIds[0],
        user2: sortedIds[1],
      });
    }
    const otherUser =
      String(matchRow.user1) === String(req.user._id)
        ? await User.findById(matchRow.user2)
        : await User.findById(matchRow.user1);
    match = {
      id: String(matchRow._id),
      matched_user: await serializePublicUser(otherUser, req),
      created_at: matchRow.created_at.toISOString(),
    };
  }

  res.status(201).json({
    message: match ? 'You have a new match.' : 'Like sent',
    is_match: Boolean(match),
    match,
  });
}

async function passUser(req, res) {
  const toUser = await User.findById(req.params.userId);
  if (!toUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const existingPass = await Pass.findOne({
    from_user: req.user._id,
    to_user: toUser._id,
  });
  if (!existingPass) {
    await Pass.create({
      from_user: req.user._id,
      to_user: toUser._id,
    });
  }
  res.json({ message: 'Passed' });
}

async function listMatches(req, res) {
  const matchRows = await Match.find({
    $or: [{ user1: req.user._id }, { user2: req.user._id }],
  }).sort({ created_at: -1 });

  const results = [];
  for (const matchRow of matchRows) {
    const otherId =
      String(matchRow.user1) === String(req.user._id) ? matchRow.user2 : matchRow.user1;
    const otherUser = await User.findById(otherId);
    results.push({
      id: String(matchRow._id),
      matched_user: await serializePublicUser(otherUser, req),
      created_at: matchRow.created_at.toISOString(),
    });
  }

  res.json({
    count: results.length,
    next: null,
    previous: null,
    results,
  });
}

async function deleteMatch(req, res) {
  const matchRow = await Match.findOne({
    _id: req.params.matchId,
    $or: [{ user1: req.user._id }, { user2: req.user._id }],
  });
  if (!matchRow) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }
  await Match.deleteOne({ _id: matchRow._id });
  res.json({ message: 'Unmatched' });
}

async function likesReceived(req, res) {
  const likeRows = await Like.find({ to_user: req.user._id }).sort({ created_at: -1 });
  const results = [];
  for (const likeRow of likeRows) {
    const fromUser = await User.findById(likeRow.from_user);
    if (!fromUser) continue;

    const iLikedThem = await Like.findOne({
      from_user: req.user._id,
      to_user: fromUser._id,
    });
    if (iLikedThem) continue;

    const sortedIds = [String(req.user._id), String(fromUser._id)].sort();
    const matchExists = await Match.findOne({
      user1: sortedIds[0],
      user2: sortedIds[1],
    });
    if (matchExists) continue;

    results.push({
      id: String(likeRow._id),
      from_user: await serializePublicUser(fromUser, req),
      created_at: likeRow.created_at.toISOString(),
    });
  }
  res.json({
    count: results.length,
    next: null,
    previous: null,
    results,
  });
}

module.exports = {
  nearby,
  next,
  likeUser,
  passUser,
  listMatches,
  deleteMatch,
  likesReceived,
  getDiscoveryFeed,
  getNearbyUsers,
};
