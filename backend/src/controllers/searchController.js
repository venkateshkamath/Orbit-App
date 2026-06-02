const { Event, Interest, Post, User } = require('../models');
const { serializePost } = require('../serializers/post');
const eventsController = require('./eventsController');
const { fullMediaUrl } = require('../utils/media');

const SEARCH_TYPES = new Set(['all', 'catchups', 'posts', 'people', 'places']);
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;
const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 12;

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeQuery(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

function readLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function scoreFields(query, fields) {
  const q = query.toLowerCase();
  let score = 100;

  for (const raw of fields) {
    const value = String(raw || '').toLowerCase();
    if (!value) continue;
    if (value === q) score = Math.min(score, 0);
    else if (value.startsWith(q)) score = Math.min(score, 1);
    else if (value.split(/\s+/).some((part) => part.startsWith(q))) score = Math.min(score, 2);
    else if (value.includes(q)) score = Math.min(score, 3);
  }

  return score;
}

function takeRanked(rows, query, limit, fieldsForRow) {
  return rows
    .map((row) => ({ row, score: scoreFields(query, fieldsForRow(row)) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ row }) => row);
}

function publicUser(user, req) {
  return {
    id: String(user._id),
    username: user.username,
    bio: user.bio || '',
    avatar: fullMediaUrl(req, user.avatar),
    city: user.city || '',
    interests: Array.isArray(user.interest_ids)
      ? user.interest_ids.map((interest) => ({
          id: String(interest._id ?? interest.id),
          name: interest.name,
          emoji: interest.emoji,
          category: interest.category,
          color: interest.color,
        }))
      : [],
    is_online: !!user.is_online,
    last_seen: user.last_seen ? new Date(user.last_seen).toISOString() : null,
    is_verified: !!user.is_verified,
  };
}

async function searchPlaces(query, limit) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ORBIT-App/1.0 (hyper-local catchups)' },
    signal: AbortSignal.timeout(4500),
  });
  if (!response.ok) return [];
  const rows = await response.json();
  return rows
    .map((item) => {
      const address = item.address || {};
      const city = address.city || address.town || address.village || address.suburb || address.county || '';
      const lat = Number.parseFloat(item.lat);
      const lng = Number.parseFloat(item.lon);
      const displayName = item.display_name || '';
      const name = item.name || displayName.split(',')[0] || displayName;
      return {
        id: item.place_id ? String(item.place_id) : `${lat},${lng}`,
        display_name: displayName,
        name,
        address: displayName,
        city,
        lat,
        lng,
      };
    })
    .filter((item) => item.name && Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function search(req, res) {
  try {
    const q = normalizeQuery(req.query.q);
    const requestedType = String(req.query.type || 'all').toLowerCase();
    const type = SEARCH_TYPES.has(requestedType) ? requestedType : 'all';
    const limit = readLimit(req.query.limit);
    if (q.length < MIN_QUERY_LENGTH) return res.json({ catchups: [], posts: [], people: [], places: [] });

    const regex = new RegExp(escapeRegex(q), 'i');
    const now = new Date();
    const response = { catchups: [], posts: [], people: [], places: [] };
    const wantsCatchups = type === 'all' || type === 'catchups';
    const wantsPosts = type === 'all' || type === 'posts';
    const wantsPeople = type === 'all' || type === 'people';
    const wantsPlaces = type === 'all' || type === 'places';

    const [matchingInterests, matchingOrganizers] = await Promise.all([
      wantsPeople
        ? Interest.find({ name: regex }).select('_id').limit(20).lean()
        : Promise.resolve([]),
      wantsCatchups
        ? User.find({ username: regex }).select('_id').limit(20).lean()
        : Promise.resolve([]),
    ]);

    const interestIds = matchingInterests.map((interest) => interest._id);
    const organizerIds = matchingOrganizers.map((user) => user._id);

    const searches = [];

    if (wantsCatchups) {
      const eventClauses = [
        { title: regex },
        { description: regex },
        { location_name: regex },
        { city: regex },
        { category: regex },
        { custom_category: regex },
      ];
      if (organizerIds.length) eventClauses.push({ organizer: { $in: organizerIds } });

      searches.push(
        Event.find({
          start_at: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
          status: { $ne: 'cancelled' },
          deleted_at: null,
          $or: eventClauses,
        })
          .sort({ start_at: 1 })
          .limit(limit * 2)
          .populate('organizer', 'username avatar')
          .populate('attendees', 'username avatar')
          .then((events) => {
            response.catchups = takeRanked(events, q, limit, (event) => {
              const e = event.toObject ? event.toObject() : event;
              return [
                e.title,
                e.description,
                e.location_name,
                e.city,
                e.category,
                e.custom_category,
                e.organizer?.username,
              ];
            }).map((event) => eventsController.serializeEvent(event, req.user._id, { viewer: req.user, req }));
          })
      );
    }

    if (wantsPosts) {
      searches.push(
        Post.find({
          privacy: 'public',
          $or: [{ caption: regex }, { location_name: regex }],
        })
          .sort({ created_at: -1 })
          .limit(limit)
          .then(async (posts) => {
            response.posts = await Promise.all(posts.map((post) => serializePost(post, req.user._id, req)));
          })
      );
    }

    if (wantsPeople) {
      const userClauses = [{ username: regex }, { city: regex }, { bio: regex }];
      if (interestIds.length) userClauses.push({ interest_ids: { $in: interestIds } });

      searches.push(
        User.find({
          _id: { $ne: req.user._id },
          $or: userClauses,
        })
          .select('username bio avatar city interest_ids is_online last_seen is_verified')
          .populate('interest_ids', 'name emoji category color')
          .limit(limit * 2)
          .lean()
          .then((users) => {
            response.people = takeRanked(users, q, limit, (user) => [
              user.username,
              user.city,
              user.bio,
              ...(Array.isArray(user.interest_ids) ? user.interest_ids.map((interest) => interest.name) : []),
            ]).map((user) => publicUser(user, req));
          })
      );
    }

    if (wantsPlaces) {
      searches.push(
        searchPlaces(q, limit)
          .then((places) => {
            response.places = places;
          })
          .catch((error) => {
            console.warn('[search] place search failed', error);
            response.places = [];
          })
      );
    }

    await Promise.all(searches);

    res.json(response);
  } catch (err) {
    console.error('[search]', err);
    res.status(500).json({ error: 'Internal server error.', code: 'SEARCH_FAILED' });
  }
}

module.exports = { search };
