const { fullMediaUrl } = require('../utils/media');

async function serializePublicUser(user, req) {
  if (!user) return null;
  await user.populate('interest_ids');
  return {
    id: String(user._id),
    username: user.username,
    bio: user.bio || '',
    avatar: fullMediaUrl(req, user.avatar),
    interests: user.interest_ids.map((interest) => ({
      id: String(interest._id),
      name: interest.name,
      emoji: interest.emoji,
      category: interest.category,
      color: interest.color,
    })),
    is_online: !!user.is_online,
    last_seen: user.last_seen ? user.last_seen.toISOString() : null,
    is_verified: !!user.is_verified,
  };
}

async function serializeUser(user, req) {
  if (!user) return null;
  await user.populate('interest_ids');
  return {
    id: String(user._id),
    email: user.email,
    username: user.username,
    bio: user.bio || '',
    avatar: fullMediaUrl(req, user.avatar),
    date_of_birth: user.date_of_birth,
    interests: user.interest_ids.map((interest) => ({
      id: String(interest._id),
      name: interest.name,
      emoji: interest.emoji,
      category: interest.category,
      color: interest.color,
    })),
    latitude: user.latitude,
    longitude: user.longitude,
    is_discoverable: !!user.is_discoverable,
    discovery_radius: user.discovery_radius ?? 10,
    show_online_status: !!user.show_online_status,
    is_online: !!user.is_online,
    last_seen: user.last_seen ? user.last_seen.toISOString() : null,
    is_verified: !!user.is_verified,
    created_at: user.created_at.toISOString(),
  };
}

module.exports = {
  serializePublicUser,
  serializeUser,
};
