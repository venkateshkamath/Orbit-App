const { User, Interest } = require('../models');
const { serializeUser } = require('../serializers/user');
const { deleteFile } = require('../utils/media');
const { asNumber, parseIdList } = require('../utils/validation');

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
  const nextDiscoveryRadius =
    updates.discovery_radius !== undefined ? Number(updates.discovery_radius) : user.discovery_radius;
  const nextShowOnlineStatus =
    updates.show_online_status !== undefined
      ? updates.show_online_status === 'true' || updates.show_online_status === true
      : user.show_online_status;
  const nextAvatar = req.file ? `${req.file.fieldname}s/${req.file.filename}` : user.avatar;

  if (nextUsername !== user.username) {
    const existingUsername = await User.findOne({
      username: new RegExp(`^${nextUsername}$`, 'i'),
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
  await user.save();

  res.json({
    message: 'Location updated',
    latitude: nextLatitude,
    longitude: nextLongitude,
    updated_at: updatedAt.toISOString(),
  });
}

async function getUserById(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ detail: 'User not found.' });
    return;
  }
  const payload = await serializeUser(user, req);
  if (String(user._id) !== String(req.user._id)) {
    payload.email = null;
  }
  res.json(payload);
}

module.exports = {
  getMe,
  patchMe,
  deleteAvatar,
  updateLocation,
  getUserById,
};
