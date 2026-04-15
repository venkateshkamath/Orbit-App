const { User, Interest, Like, Match } = require('../models');
const { serializeUser, serializePublicUser } = require('../serializers/user');
const { deleteFile } = require('../utils/media');
const { asNumber, parseIdList } = require('../utils/validation');
const { haversineDistance } = require('../utils/geo');
const { syncUserGeoPoint } = require('../utils/userLocation');

async function getMe(req, res) {
  const user = await User.findById(req.user._id);
  res.json(await serializeUser(user, req));
}

async function patchMe(req, res) {
  const user = await User.findById(req.user._id);
  const updates = req.body || {};
  const interestIds = parseIdList(updates.interest_ids || updates['interest_ids[]']);

  const nextBio = updates.bio !== undefined ? String(updates.bio) : user.bio;
  const nextUsername = updates.username !== undefined ? String(updates.username).trim() : user.username;
  const nextDateOfBirth = updates.date_of_birth !== undefined ? updates.date_of_birth || null : user.date_of_birth;
  const nextLatitude = updates.latitude !== undefined ? asNumber(updates.latitude) : user.latitude;
  const nextLongitude = updates.longitude !== undefined ? asNumber(updates.longitude) : user.longitude;
  const nextIsDiscoverable =
    updates.is_discoverable !== undefined
      ? updates.is_discoverable === 'true' || updates.is_discoverable === true
      : user.is_discoverable;
  const MIN_RADIUS = 100;
  const MAX_RADIUS = 10000;
  let nextDiscoveryRadius = user.discovery_radius;
  if (updates.discovery_radius !== undefined) {
    const raw = Number(updates.discovery_radius);
    if (!Number.isFinite(raw)) {
      res.status(400).json({ discovery_radius: ['Invalid number.'] });
      return;
    }
    nextDiscoveryRadius = Math.min(Math.max(Math.round(raw), MIN_RADIUS), MAX_RADIUS);
  }
  const nextShowOnlineStatus =
    updates.show_online_status !== undefined
      ? updates.show_online_status === 'true' || updates.show_online_status === true
      : user.show_online_status;
  const nextAvatar = req.file ? req.file.path : user.avatar;

  if (nextUsername !== user.username) {
    const escapedUsername = String(nextUsername).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingUsername = await User.findOne({
      username: new RegExp(`^${escapedUsername}$`, 'i'),
      _id: { $ne: user._id },
    });
    if (existingUsername) {
      if (req.file) {
        deleteFile(nextAvatar);
      }
      res.status(400).json({ username: ['A user with that username already exists.'] });
      return;
    }
  }

  if (req.file && user.avatar) {
    deleteFile(user.avatar);
  }

  user.username = nextUsername;
  user.bio = nextBio;
  user.avatar = nextAvatar;
  user.date_of_birth = nextDateOfBirth;
  user.latitude = nextLatitude;
  user.longitude = nextLongitude;
  user.is_discoverable = !!nextIsDiscoverable;
  user.discovery_radius = nextDiscoveryRadius;
  user.show_online_status = !!nextShowOnlineStatus;
  if (updates.latitude !== undefined || updates.longitude !== undefined) {
    user.location_updated_at = new Date();
  }

  syncUserGeoPoint(user);

  if (interestIds.length > 0 || updates.interest_ids !== undefined || updates['interest_ids[]'] !== undefined) {
    const interests = await Interest.find({ _id: { $in: interestIds } });
    user.interest_ids = interests.map((interest) => interest._id);
  }

  await user.save();
  res.json(await serializeUser(user, req));
}

async function deleteAvatar(req, res) {
  const user = await User.findById(req.user._id);
  if (user.avatar) {
    deleteFile(user.avatar);
  }
  user.avatar = null;
  await user.save();
  res.json(await serializeUser(user, req));
}

async function updateLocation(req, res) {
  const { latitude, longitude } = req.body || {};
  const nextLatitude = asNumber(latitude);
  const nextLongitude = asNumber(longitude);
  if (nextLatitude === null || nextLongitude === null) {
    res.status(400).json({ detail: 'Latitude and longitude are required.' });
    return;
  }

  const updatedAt = new Date();
  const user = await User.findById(req.user._id);
  user.latitude = nextLatitude;
  user.longitude = nextLongitude;
  user.location_updated_at = updatedAt;
  syncUserGeoPoint(user);
  await user.save();

  res.json({
    message: 'Location updated',
    latitude: nextLatitude,
    longitude: nextLongitude,
    updated_at: updatedAt.toISOString(),
  });
}

async function getUserById(req, res) {
  if (String(req.params.id) !== String(req.user._id)) {
    res.status(403).json({ detail: 'Use GET /api/users/:id/profile/ for other users.' });
    return;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }
  res.json(await serializeUser(user, req));
}

/** Public profile + distance + Join orbit state (no target lat/lng exposed). */
async function getPublicProfile(req, res) {
  const viewer = await User.findById(req.user._id);
  const target = await User.findById(req.params.id);
  if (!target) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }

  const publicUser = await serializePublicUser(target, req);
  const self = String(target._id) === String(viewer._id);

  let distance_m = null;
  if (
    !self &&
    viewer.latitude != null &&
    viewer.longitude != null &&
    target.latitude != null &&
    target.longitude != null
  ) {
    distance_m =
      Math.round(
        haversineDistance(
          Number(viewer.latitude),
          Number(viewer.longitude),
          Number(target.latitude),
          Number(target.longitude)
        ) * 10
      ) / 10;
  }

  const likeFromMe = await Like.findOne({ from_user: viewer._id, to_user: target._id });
  const likeFromThem = await Like.findOne({ from_user: target._id, to_user: viewer._id });
  const sortedIds = [String(viewer._id), String(target._id)].sort();
  const matchRow = await Match.findOne({ user1: sortedIds[0], user2: sortedIds[1] });

  res.json({
    user: publicUser,
    distance_m: self ? 0 : distance_m,
    is_self: self,
    orbit: {
      you_sent_join: !!likeFromMe,
      they_sent_join: !!likeFromThem,
      matched: !!matchRow,
      match_id: matchRow ? String(matchRow._id) : null,
    },
  });
}

/** GET /api/users/search?q=<term>
 *  Search users by username, bio, or interest name. Excludes self.
 *  Returns up to 30 results, each enriched with the current user's orbit state.
 */
async function searchUsers(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ results: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    // Find interests whose name matches the query
    const matchingInterests = await Interest.find({ name: regex }).lean();
    const interestIds = matchingInterests.map((i) => i._id);

    const orClauses = [{ username: regex }, { bio: regex }];
    if (interestIds.length) orClauses.push({ interest_ids: { $in: interestIds } });

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: orClauses,
    }).limit(30);

    const results = [];
    for (const target of users) {
      const publicUser = await serializePublicUser(target, req);

      const [likeFromMe, likeFromThem, matchRow] = await Promise.all([
        Like.findOne({ from_user: req.user._id, to_user: target._id }),
        Like.findOne({ from_user: target._id, to_user: req.user._id }),
        Match.findOne({
          $or: [
            { user1: req.user._id, user2: target._id },
            { user1: target._id, user2: req.user._id },
          ],
        }),
      ]);

      results.push({
        ...publicUser,
        orbit: {
          you_sent_join: !!likeFromMe,
          they_sent_join: !!likeFromThem,
          matched: !!matchRow,
          match_id: matchRow ? String(matchRow._id) : null,
        },
      });
    }

    res.json({ results });
  } catch (err) {
    console.error('[searchUsers]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function registerExpoPushToken(req, res) {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ detail: 'token is required.' });
    return;
  }
  await User.updateOne({ _id: req.user._id }, { $set: { expo_push_token: token } });
  res.json({ ok: true });
}

async function updatePresence(req, res) {
  const { is_online } = req.body || {};
  if (typeof is_online !== 'boolean') {
    res.status(400).json({ detail: 'is_online must be a boolean.' });
    return;
  }

  const patch = is_online
    ? { is_online: true }
    : { is_online: false, last_seen: new Date() };

  await User.updateOne({ _id: req.user._id }, { $set: patch });
  res.json({ ok: true, is_online });
}

module.exports = {
  getMe,
  patchMe,
  deleteAvatar,
  updateLocation,
  getUserById,
  getPublicProfile,
  searchUsers,
  registerExpoPushToken,
  updatePresence,
};
