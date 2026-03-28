const { fullMediaUrl } = require('../utils/media');

/**
 * JSON shape for a public user when `interest_ids` are already populated (sync; no DB).
 */
function serializePublicUserSync(user, req) {
  if (!user) return null;
  const raw = user.interest_ids || [];
  const interests = raw
    .filter((interest) => interest && typeof interest === 'object' && interest.name != null)
    .map((interest) => ({
      id: String(interest._id),
      name: interest.name,
      emoji: interest.emoji,
      category: interest.category,
      color: interest.color,
    }));
  return {
    id: String(user._id),
    username: user.username,
    bio: user.bio || '',
    avatar: fullMediaUrl(req, user.avatar),
    interests,
    is_online: !!user.is_online,
    last_seen: user.last_seen ? new Date(user.last_seen).toISOString() : null,
    is_verified: !!user.is_verified,
  };
}

async function serializePublicUser(user, req) {
  if (!user) return null;
  await user.populate('interest_ids');
  return serializePublicUserSync(user, req);
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
    discovery_radius: user.discovery_radius ?? 1000,
    show_online_status: !!user.show_online_status,
    is_online: !!user.is_online,
    last_seen: user.last_seen ? user.last_seen.toISOString() : null,
    is_verified: !!user.is_verified,
    created_at: user.created_at.toISOString(),
  };
}

module.exports = {
  serializePublicUser,
  serializePublicUserSync,
  serializeUser,
};
