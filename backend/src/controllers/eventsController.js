const { z } = require('zod');
const { Event, Conversation, Message, EVENT_CATEGORIES } = require('../models');
const { haversineDistance } = require('../utils/geo');
const { deleteFromCloudinary } = require('../utils/media');

const eventCategorySet = new Set(EVENT_CATEGORIES);

const catchupSchema = z.object({
  name: z.string().trim().min(3).max(60),
  dateTime: z.coerce.date(),
  joinMode: z.enum(['open', 'approval']).default('open'),
  maxPeople: z.coerce.number().int().min(2).max(100).default(10),
  categoryId: z.string().trim().nullable().optional(),
  customCategory: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  coverPhotoIndex: z.coerce.number().int().min(0).default(0),
});

const catchupUpdateSchema = catchupSchema.partial();

const legacyEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000),
  start_at: z.coerce.date(),
  end_at: z.coerce.date().nullable().optional(),
  location_name: z.string().trim().min(1),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  category: z.enum(EVENT_CATEGORIES),
});

function jsonField(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeExistingPhotos(value) {
  const parsed = jsonField(value, []);
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map((photo) => {
      const url = String(photo?.url || '').trim();
      if (!url) return null;
      return {
        url,
        public_id: photo?.public_id ? String(photo.public_id) : null,
      };
    })
    .filter(Boolean);
}

function structuredError(res, status, error, code, details) {
  return res.status(status).json({ error, code, ...(details ? { details } : {}) });
}

function normalizeCategory(categoryId, customCategory) {
  const raw = String(categoryId || '').trim().toLowerCase();
  if (eventCategorySet.has(raw)) return raw;
  const byName = EVENT_CATEGORIES.find((cat) => cat.toLowerCase() === raw);
  if (byName) return byName;
  if (customCategory) return 'social';
  return raw && eventCategorySet.has(raw) ? raw : null;
}

async function geocodeText(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'ORBIT-App/1.0 (hyper-local catchups)' },
    signal: AbortSignal.timeout(6500),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.map((item) => {
    const address = item.address || {};
    const city = address.city || address.town || address.village || address.suburb || address.county || '';
    const displayName = item.display_name || '';
    return {
      name: item.name || displayName.split(',')[0] || displayName,
      address: displayName,
      city,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function resolveGoogleMapsUrl(rawUrl) {
  const url = String(rawUrl || '').trim();
  if (!/^https?:\/\/(maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(url)) {
    return null;
  }

  let finalUrl = url;
  if (/goo\.gl\/maps|maps\.app\.goo\.gl/i.test(url)) {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
    }).catch(() => null);
    finalUrl = response?.url || url;
  }

  const decoded = decodeURIComponent(finalUrl);
  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const qMatch = decoded.match(/[?&]q=([^&]+)/);
  const placeMatch = decoded.match(/\/place\/([^/@?]+)/);
  const name = (placeMatch?.[1] || qMatch?.[1] || 'Google Maps location').replace(/\+/g, ' ').trim();
  const lat = atMatch ? parseFloat(atMatch[1]) : null;
  const lng = atMatch ? parseFloat(atMatch[2]) : null;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const reverse = await fetch(reverseUrl, {
      headers: { 'User-Agent': 'ORBIT-App/1.0 (hyper-local catchups)' },
      signal: AbortSignal.timeout(6500),
    }).catch(() => null);
    if (reverse?.ok) {
      const data = await reverse.json();
      const address = data.address || {};
      const city = address.city || address.town || address.village || address.suburb || address.county || '';
      return { name, address: data.display_name || name, city, lat, lng };
    }
    return { name, address: name, city: '', lat, lng };
  }

  const results = await geocodeText(name);
  return results[0] || { name, address: name, city: '', lat: null, lng: null };
}

/* ── helpers ─────────────────────────────────────────────────────── */

const FEED_RADIUS_M = 20000;
const EARTH_RADIUS_M = 6371000;
const ACTIVE_EVENT_GRACE_MS = 2 * 60 * 60 * 1000;
const FEED_FILTERS = new Set(['near', 'today', 'week', 'popular']);

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCity(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function sameId(left, right) {
  if (left == null || right == null) return false;
  return String(left?._id ?? left) === String(right?._id ?? right);
}

function isEventCompleted(event, now = new Date()) {
  const endOrStart = event.end_at || event.start_at;
  const date = endOrStart ? new Date(endOrStart) : null;
  return Boolean(date && !Number.isNaN(date.getTime()) && date.getTime() < now.getTime());
}

function activeEventsQuery() {
  return { status: { $ne: 'cancelled' }, deleted_at: null };
}

function isEventDeleted(event) {
  return Boolean(event?.deleted_at) || event?.status === 'cancelled';
}

function eventDistanceMeters(event, viewer) {
  if (typeof event.distance_m === 'number' && Number.isFinite(event.distance_m)) {
    return Math.round(event.distance_m);
  }
  const viewerLat = finiteNumber(viewer?.latitude);
  const viewerLng = finiteNumber(viewer?.longitude);
  const eventLat = finiteNumber(event.latitude);
  const eventLng = finiteNumber(event.longitude);
  if (viewerLat == null || viewerLng == null || eventLat == null || eventLng == null) return null;
  return Math.round(haversineDistance(viewerLat, viewerLng, eventLat, eventLng));
}

function mediaUrlForRequest(req, url) {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (/^(https?:|data:|file:|content:)/i.test(value)) return value;
  if (!req) return value;

  const normalized = value.replace(/^\/+/, '');
  const mediaPath = normalized.startsWith('media/') ? normalized : `media/${normalized}`;
  return `${req.protocol}://${req.get('host')}/${mediaPath}`;
}

function cityScopeExpression(city) {
  const normalized = normalizeCity(city);
  if (!normalized) return null;
  return {
    $expr: {
      $eq: [
        { $toLower: { $trim: { input: { $ifNull: ['$city', ''] } } } },
        normalized,
      ],
    },
  };
}

function buildFeedScopeQuery(user, radiusM = FEED_RADIUS_M) {
  const clauses = [];
  if (user?._id) clauses.push({ organizer: user._id });

  const userLat = finiteNumber(user?.latitude);
  const userLng = finiteNumber(user?.longitude);
  if (userLat != null && userLng != null) {
    clauses.push({
      location: {
        $geoWithin: {
          $centerSphere: [[userLng, userLat], radiusM / EARTH_RADIUS_M],
        },
      },
    });
  }

  const cityExpr = cityScopeExpression(user?.city);
  if (cityExpr) clauses.push(cityExpr);

  return clauses.length ? { $or: clauses } : {};
}

function eventMatchesFeedScope(event, user, radiusM = FEED_RADIUS_M) {
  if (sameId(event.organizer, user?._id)) return true;

  const userCity = normalizeCity(user?.city);
  if (userCity && normalizeCity(event.city) === userCity) return true;

  const userLat = finiteNumber(user?.latitude);
  const userLng = finiteNumber(user?.longitude);
  const eventLat = finiteNumber(event.latitude);
  const eventLng = finiteNumber(event.longitude);
  if (userLat == null || userLng == null || eventLat == null || eventLng == null) return false;

  return haversineDistance(userLat, userLng, eventLat, eventLng) <= radiusM;
}

function normalizeFeedFilter(value) {
  const filter = String(value || 'near').toLowerCase();
  return FEED_FILTERS.has(filter) ? filter : 'near';
}

function validDate(value) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarDayRange(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function calendarWeekRange(date) {
  const start = new Date(date);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function requestedDateRange(query) {
  const start = validDate(query.start);
  const end = validDate(query.end);
  return start && end && start <= end ? { start, end } : null;
}

function requestedStart(query) {
  return validDate(query.start);
}

function buildFeedQuery({ user, filter, clientRange, clientStart, now = new Date() }) {
  const normalizedFilter = normalizeFeedFilter(filter);
  const query = {
    ...activeEventsQuery(),
    ...buildFeedScopeQuery(user),
  };

  if (normalizedFilter === 'today') {
    const { start, end } = clientRange || calendarDayRange(now);
    query.start_at = { $gte: start, $lte: end };
  } else if (normalizedFilter === 'week') {
    const { start, end } = clientRange || calendarWeekRange(now);
    query.start_at = { $gte: start, $lte: end };
  } else {
    query.start_at = { $gte: clientStart || new Date(now.getTime() - ACTIVE_EVENT_GRACE_MS) };
  }

  return query;
}

function popularityMetrics(event, now = new Date()) {
  const attendeeCount = Array.isArray(event.attendees) ? event.attendees.length : Number(event.attendee_count || 0);
  const maxPeople = Math.max(Number(event.max_people || 10), 1);
  const fillRatio = attendeeCount / maxPeople;
  const start = new Date(event.start_at);
  const hoursUntilStart = Number.isNaN(start.getTime()) ? Number.POSITIVE_INFINITY : (start.getTime() - now.getTime()) / 3600000;
  let soonnessScore = 0;
  if (hoursUntilStart >= 0 && hoursUntilStart <= 6) soonnessScore = 3;
  else if (hoursUntilStart > 6 && hoursUntilStart <= 24) soonnessScore = 2;
  else if (hoursUntilStart > 24 && hoursUntilStart <= 72) soonnessScore = 1;

  return { attendeeCount, fillRatio, soonnessScore };
}

function comparePopularEvents(a, b, now = new Date()) {
  const left = popularityMetrics(a, now);
  const right = popularityMetrics(b, now);
  if (right.attendeeCount !== left.attendeeCount) return right.attendeeCount - left.attendeeCount;
  if (right.fillRatio !== left.fillRatio) return right.fillRatio - left.fillRatio;
  if (right.soonnessScore !== left.soonnessScore) return right.soonnessScore - left.soonnessScore;
  return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
}

function buildFeedSort(filter, hasViewerLocation) {
  if (filter === 'popular') {
    return { attendee_count_sort: -1, fill_ratio_sort: -1, soonness_sort: -1, start_at: 1 };
  }
  if (filter === 'near' && hasViewerLocation) {
    return { is_completed_sort: 1, is_today_sort: -1, distance_missing_sort: 1, distance_sort_m: 1, start_at: 1 };
  }
  if (filter === 'near') {
    return { is_completed_sort: 1, is_today_sort: -1, start_at: 1 };
  }
  return { is_completed_sort: 1, start_at: 1 };
}

function serializeEvent(event, requestingUserId, options = {}) {
  const e = event.toObject ? event.toObject() : event;
  const now = options.now || new Date();
  const viewer = options.viewer || null;
  const req = options.req || null;
  const attendeePreviewLimit = Number.isFinite(options.attendeePreviewLimit)
    ? Math.max(0, Math.min(Number(options.attendeePreviewLimit), 100))
    : 8;
  const rawPhotos = Array.isArray(e.photos) && e.photos.length
    ? e.photos
    : (e.image ? [{ url: e.image, public_id: e.image_public_id ?? null }] : []);
  const photos = rawPhotos
    .map((photo) => ({ url: mediaUrlForRequest(req, photo.url), public_id: photo.public_id ?? null }))
    .filter((photo) => photo.url);
  const coverPhotoIndex = photos.length ? Math.min(e.cover_photo_index ?? 0, photos.length - 1) : 0;
  const attendees = Array.isArray(e.attendees) ? e.attendees : [];
  const attendeesPreview = attendees
    .filter((attendee) => attendee && typeof attendee === 'object' && attendee.username)
    .slice(0, attendeePreviewLimit)
    .map((attendee) => ({
      id: String(attendee._id ?? attendee.id),
      username: attendee.username,
      avatar: attendee.avatar ?? null,
    }));
  const distanceM = eventDistanceMeters(e, viewer);
  return {
    id:            String(e._id),
    title:         e.title,
    description:   e.description,
    organizer: e.organizer
      ? {
          id:       String(e.organizer._id ?? e.organizer),
          username: e.organizer.username ?? null,
          avatar:   e.organizer.avatar   ?? null,
          is_online: !!e.organizer.is_online,
          last_seen: e.organizer.last_seen ? new Date(e.organizer.last_seen).toISOString() : null,
        }
      : null,
    start_at:      e.start_at,
    end_at:        e.end_at ?? null,
    location_name: e.location_name,
    address:       e.address ?? '',
    city:          e.city ?? '',
    location_source: e.location_source ?? 'legacy',
    latitude:      e.latitude,
    longitude:     e.longitude,
    category:      e.category,
    category_id:   e.category_id ?? null,
    custom_category: e.custom_category ?? null,
    join_mode:     e.join_mode ?? 'open',
    max_people:    e.max_people ?? 10,
    image_url:     photos[coverPhotoIndex]?.url ?? mediaUrlForRequest(req, e.image) ?? null,
    photos,
    cover_photo_index: coverPhotoIndex,
    status:        e.status ?? 'live',
    is_completed:  isEventCompleted(e, now),
    ...(distanceM != null ? { distance_m: distanceM } : {}),
    attendee_count: attendees.length,
    attendees_preview: attendeesPreview,
    spots_left: Math.max((e.max_people ?? 10) - attendees.length, 0),
    conversation_id: e.conversation ? String(e.conversation) : null,
    has_joined: requestingUserId
      ? attendees.some((id) => String(id?._id ?? id) === String(requestingUserId))
      : false,
    is_own: requestingUserId
      ? String(e.organizer?._id ?? e.organizer) === String(requestingUserId)
      : false,
    created_at: e.created_at,
  };
}

/* ── GET /api/events/nearby ──────────────────────────────────────── */

async function nearbyEvents(req, res) {
  try {
    const lat    = parseFloat(req.query.lat);
    const lng    = parseFloat(req.query.lng);
    const radius = Math.min(parseInt(req.query.radius, 10) || 5000, 50000);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }

    const now = new Date();

    const events = await Event.aggregate([
      {
        $geoNear: {
          near:          { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance_m',
          maxDistance:   radius,
          spherical:     true,
          query:         {
            start_at: { $gte: new Date(now.getTime() - ACTIVE_EVENT_GRACE_MS) },
            ...activeEventsQuery(),
          },
        },
      },
      { $sort: { start_at: 1 } },
      { $limit: 60 },
      {
        $lookup: {
          from:         'users',
          localField:   'organizer',
          foreignField: '_id',
          as:           'organizer',
          pipeline:     [{ $project: { username: 1, avatar: 1 } }],
        },
      },
      { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } },
    ]);

    res.json({
      count:  events.length,
      radius,
      events: events.map((event) => serializeEvent(event, req.user._id, {
        now,
        viewer: { latitude: lat, longitude: lng },
        req,
      })),
    });
  } catch (err) {
    console.error('[nearbyEvents]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── POST /api/events ────────────────────────────────────────────── */

async function createEvent(req, res) {
  try {
    const parsed = legacyEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return structuredError(res, 400, 'Invalid event payload.', 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const { title, description, start_at, end_at, location_name, latitude, longitude, category } = parsed.data;
    if (start_at.getTime() <= Date.now()) {
      return structuredError(res, 400, 'Event date must be in the future.', 'DATE_IN_PAST');
    }

    const event = await Event.create({
      title,
      description,
      organizer:     req.user._id,
      start_at,
      end_at:        end_at ?? null,
      location_name,
      location:      { type: 'Point', coordinates: [longitude, latitude] },
      latitude,
      longitude,
      category,
      image:          req.file?.path ?? null,
      image_public_id: req.file?.filename ?? null,
      attendees:      [req.user._id],
    });

    const conversation = await Conversation.create({
      kind: 'event',
      name: event.title,
      event: event._id,
      participants: [req.user._id],
    });
    event.conversation = conversation._id;
    await event.save();

    await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      message_type: 'event',
      content: `${req.user.username} created ${event.title}. Ask questions here or swipe to join.`,
    });

    await event.populate('organizer', 'username avatar');
    res.status(201).json(serializeEvent(event, req.user._id, { viewer: req.user, req }));
  } catch (err) {
    console.error('[createEvent]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── GET /api/events/feed ───────────────────────────────────────── */

async function listEvents(req, res) {
  try {
    const now = new Date();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);
    const filter = normalizeFeedFilter(req.query.filter);
    const skip = (page - 1) * limit;
    const clientRange = requestedDateRange(req.query);
    const clientStart = requestedStart(req.query);
    const query = buildFeedQuery({ user: req.user, filter, clientRange, clientStart, now });
    const viewerLat = finiteNumber(req.user.latitude);
    const viewerLng = finiteNumber(req.user.longitude);
    const hasViewerLocation = viewerLat != null && viewerLng != null;
    const metersPerLngDegree = hasViewerLocation
      ? 111320 * Math.cos((viewerLat * Math.PI) / 180)
      : 111320;
    const sort = buildFeedSort(filter, hasViewerLocation);
    const sortTodayRange = clientRange || (clientStart
      ? { start: clientStart, end: new Date(clientStart.getTime() + 24 * 60 * 60 * 1000 - 1) }
      : calendarDayRange(now));

    const aggregatePipeline = [
      { $match: query },
      {
        $addFields: {
          attendee_count_sort: { $size: { $ifNull: ['$attendees', []] } },
          max_people_sort: { $cond: [{ $gt: ['$max_people', 0] }, '$max_people', 10] },
          is_completed_sort: { $lt: [{ $ifNull: ['$end_at', '$start_at'] }, now] },
          is_today_sort: {
            $and: [
              { $gte: ['$start_at', sortTodayRange.start] },
              { $lte: ['$start_at', sortTodayRange.end] },
            ],
          },
          hours_until_start_sort: { $divide: [{ $subtract: ['$start_at', now] }, 3600000] },
          has_location_sort: {
            $and: [
              { $ne: ['$latitude', null] },
              { $ne: ['$longitude', null] },
            ],
          },
        },
      },
      {
        $addFields: {
          distance_missing_sort: { $cond: ['$has_location_sort', 0, 1] },
          distance_sort_m: hasViewerLocation
            ? {
                $cond: [
                  '$has_location_sort',
                  {
                    $sqrt: {
                      $add: [
                        {
                          $pow: [
                            { $multiply: [{ $subtract: ['$latitude', viewerLat] }, 111320] },
                            2,
                          ],
                        },
                        {
                          $pow: [
                            { $multiply: [{ $subtract: ['$longitude', viewerLng] }, metersPerLngDegree] },
                            2,
                          ],
                        },
                      ],
                    },
                  },
                  Number.MAX_SAFE_INTEGER,
                ],
              }
            : Number.MAX_SAFE_INTEGER,
          fill_ratio_sort: {
            $cond: [
              { $gt: ['$max_people_sort', 0] },
              { $divide: ['$attendee_count_sort', '$max_people_sort'] },
              0,
            ],
          },
          soonness_sort: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: ['$hours_until_start_sort', 0] },
                      { $lte: ['$hours_until_start_sort', 6] },
                    ],
                  },
                  then: 3,
                },
                {
                  case: {
                    $and: [
                      { $gt: ['$hours_until_start_sort', 6] },
                      { $lte: ['$hours_until_start_sort', 24] },
                    ],
                  },
                  then: 2,
                },
                {
                  case: {
                    $and: [
                      { $gt: ['$hours_until_start_sort', 24] },
                      { $lte: ['$hours_until_start_sort', 72] },
                    ],
                  },
                  then: 1,
                },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'organizer',
          foreignField: '_id',
          as: 'organizer',
          pipeline: [{ $project: { username: 1, avatar: 1 } }],
        },
      },
      { $unwind: { path: '$organizer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'attendees',
          foreignField: '_id',
          as: 'attendees',
          pipeline: [{ $project: { username: 1, avatar: 1 } }],
        },
      },
    ];

    const [total, events] = await Promise.all([
      Event.countDocuments(query),
      Event.aggregate(aggregatePipeline),
    ]);

    res.json({
      count: total,
      results: events.map((event) => serializeEvent(event, req.user._id, { now, viewer: req.user, req })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    });
  } catch (err) {
    console.error('[listEvents]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── GET /api/events/:id ─────────────────────────────────────────── */

async function getEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'username avatar is_online last_seen')
      .populate('attendees', 'username avatar');
    if (!event || isEventDeleted(event)) return res.status(404).json({ error: 'Event not found.' });
    res.json(serializeEvent(event, req.user._id, { viewer: req.user, req, attendeePreviewLimit: 100 }));
  } catch (err) {
    console.error('[getEvent]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── POST /api/events/:id/join ─────────────────────────────────── */

async function joinEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'username avatar is_online last_seen');
    if (!event || isEventDeleted(event)) return res.status(404).json({ error: 'Event not found.' });
    if (isEventCompleted(event)) {
      return structuredError(res, 400, 'This catchup has already completed.', 'EVENT_COMPLETED');
    }

    const alreadyJoined = event.attendees.some((id) => String(id) === String(req.user._id));
    if (!alreadyJoined && event.attendees.length >= (event.max_people ?? 10)) {
      return structuredError(res, 409, 'This catchup is full.', 'EVENT_FULL');
    }

    let conversation = event.conversation
      ? await Conversation.findById(event.conversation)
      : null;

    if (!conversation) {
      conversation = await Conversation.create({
        kind: 'event',
        name: event.title,
        event: event._id,
        participants: [event.organizer?._id ?? event.organizer],
      });
      event.conversation = conversation._id;
    }

    if (!alreadyJoined) {
      event.attendees.push(req.user._id);
    }
    if (!conversation.participants.some((id) => String(id) === String(req.user._id))) {
      conversation.participants.push(req.user._id);
    }

    await Promise.all([event.save(), conversation.save()]);

    if (!alreadyJoined) {
      await Message.create({
        conversation: conversation._id,
        sender: req.user._id,
        message_type: 'event_join',
        content: `${req.user.username} joined ${event.title}.`,
      });
    }

    await event.populate('attendees', 'username avatar');

    res.json({
      event: serializeEvent(event, req.user._id, { viewer: req.user, req }),
      conversation_id: String(conversation._id),
    });
  } catch (err) {
    console.error('[joinEvent]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── DELETE /api/events/:id ──────────────────────────────────────── */

async function deleteEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (String(event.organizer) !== String(req.user._id))
      return res.status(403).json({ error: 'Only the organizer can delete this event.' });

    if (event.image_public_id) {
      deleteFromCloudinary(event.image_public_id).catch((e) =>
        console.warn('[deleteEvent] cloudinary cleanup failed', e)
      );
    }

    await event.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error('[deleteEvent]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── GET /api/events/location-search ────────────────────────────── */

async function locationSearch(req, res) {
  try {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return res.json([]);

    const results = (await geocodeText(q)).map((item) => ({
      display_name: item.address,
      name: item.name,
      address: item.address,
      city: item.city,
      lat: item.lat,
      lng: item.lng,
    }));

    res.json(results);
  } catch (err) {
    console.error('[locationSearch]', err);
    res.json([]);
  }
}

async function parseGoogleMaps(req, res) {
  try {
    const result = await resolveGoogleMapsUrl(req.body?.url);
    if (!result) {
      return structuredError(res, 400, 'Not a valid Google Maps link.', 'INVALID_GOOGLE_MAPS_LINK');
    }
    res.json(result);
  } catch (err) {
    console.error('[parseGoogleMaps]', err);
    structuredError(res, 422, 'Could not resolve that Google Maps link.', 'GMAPS_PARSE_FAILED');
  }
}

async function listCategories(req, res) {
  try {
    res.json(EVENT_CATEGORIES.map((category) => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1),
    })));
  } catch (err) {
    console.error('[listCategories]', err);
    structuredError(res, 500, 'Internal server error.', 'INTERNAL_ERROR');
  }
}

async function createCatchup(req, res) {
  try {
    const location = jsonField(req.body.location);
    if (!location || typeof location !== 'object') {
      return structuredError(res, 400, 'Location is required.', 'LOCATION_REQUIRED');
    }

    const parsed = catchupSchema.safeParse(req.body);
    if (!parsed.success) {
      return structuredError(res, 400, 'Invalid catchup payload.', 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const payload = parsed.data;
    if (payload.dateTime.getTime() <= Date.now()) {
      return structuredError(res, 400, 'Catchup date must be in the future.', 'DATE_IN_PAST');
    }

    const lat = Number(location.lat);
    const lng = Number(location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return structuredError(res, 400, 'Location coordinates are required.', 'LOCATION_COORDINATES_REQUIRED');
    }

    const category = normalizeCategory(payload.categoryId, payload.customCategory);
    if (!category) {
      return structuredError(res, 400, 'Category is required.', 'CATEGORY_REQUIRED');
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const photos = files.map((file) => ({
      url: file.path,
      public_id: file.filename ?? null,
    }));
    const coverPhotoIndex = photos.length ? Math.min(payload.coverPhotoIndex, photos.length - 1) : 0;

    const event = await Event.create({
      title: payload.name,
      description: payload.description || '',
      organizer: req.user._id,
      start_at: payload.dateTime,
      end_at: null,
      location_name: String(location.name || location.address || '').trim(),
      address: String(location.address || location.name || '').trim(),
      city: String(location.city || '').trim(),
      location_source: ['search', 'gmaps', 'manual'].includes(location.source) ? location.source : 'manual',
      location: { type: 'Point', coordinates: [lng, lat] },
      latitude: lat,
      longitude: lng,
      category,
      category_id: payload.categoryId || null,
      custom_category: payload.customCategory || null,
      join_mode: payload.joinMode,
      max_people: payload.maxPeople,
      image: photos[coverPhotoIndex]?.url ?? null,
      image_public_id: photos[coverPhotoIndex]?.public_id ?? null,
      photos,
      cover_photo_index: coverPhotoIndex,
      status: 'live',
      attendees: [req.user._id],
    });

    const conversation = await Conversation.create({
      kind: 'event',
      name: event.title,
      event: event._id,
      participants: [req.user._id],
    });
    event.conversation = conversation._id;
    await event.save();

    await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      message_type: 'event',
      content: `${req.user.username} created ${event.title}. Ask questions here or join in.`,
    });

    await event.populate('organizer', 'username avatar');
    res.status(201).json({
      id: String(event._id),
      status: event.status,
      createdAt: event.created_at,
      event: serializeEvent(event, req.user._id, { viewer: req.user, req }),
    });
  } catch (err) {
    console.error('[createCatchup]', err);
    structuredError(res, 500, 'Internal server error.', 'INTERNAL_ERROR');
  }
}

async function loadEditableCatchup(req, res, actionLabel) {
  const event = await Event.findById(req.params.id);
  if (!event || isEventDeleted(event)) {
    structuredError(res, 404, 'Catchup not found.', 'CATCHUP_NOT_FOUND');
    return null;
  }
  if (String(event.organizer) !== String(req.user._id)) {
    structuredError(res, 403, `Only the organizer can ${actionLabel} this catchup.`, 'CATCHUP_FORBIDDEN');
    return null;
  }
  if (isEventCompleted(event)) {
    structuredError(res, 400, 'Completed catchups cannot be changed.', 'EVENT_COMPLETED');
    return null;
  }
  return event;
}

async function updateCatchup(req, res) {
  try {
    const event = await loadEditableCatchup(req, res, 'edit');
    if (!event) return;

    const parsed = catchupUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return structuredError(res, 400, 'Invalid catchup payload.', 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const payload = parsed.data;
    const hasLocation = Object.prototype.hasOwnProperty.call(req.body, 'location');
    const location = hasLocation ? jsonField(req.body.location) : null;
    if (hasLocation) {
      if (!location || typeof location !== 'object') {
        return structuredError(res, 400, 'Location is invalid.', 'LOCATION_REQUIRED');
      }
      const lat = Number(location.lat);
      const lng = Number(location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return structuredError(res, 400, 'Location coordinates are required.', 'LOCATION_COORDINATES_REQUIRED');
      }
      event.location_name = String(location.name || location.address || '').trim();
      event.address = String(location.address || location.name || '').trim();
      event.city = String(location.city || '').trim();
      event.location_source = ['search', 'gmaps', 'manual'].includes(location.source) ? location.source : 'manual';
      event.location = { type: 'Point', coordinates: [lng, lat] };
      event.latitude = lat;
      event.longitude = lng;
    }

    if (payload.name !== undefined) event.title = payload.name;
    if (payload.description !== undefined) event.description = payload.description || '';
    if (payload.dateTime !== undefined) {
      if (payload.dateTime.getTime() <= Date.now()) {
        return structuredError(res, 400, 'Catchup date must be in the future.', 'DATE_IN_PAST');
      }
      event.start_at = payload.dateTime;
      event.end_at = null;
    }
    if (payload.joinMode !== undefined) event.join_mode = payload.joinMode;
    if (payload.maxPeople !== undefined) {
      const attendeeCount = Array.isArray(event.attendees) ? event.attendees.length : 0;
      if (payload.maxPeople < attendeeCount) {
        return structuredError(
          res,
          400,
          'Capacity cannot be lower than current attendees.',
          'CAPACITY_BELOW_ATTENDEES'
        );
      }
      event.max_people = payload.maxPeople;
    }

    const categoryInputChanged =
      Object.prototype.hasOwnProperty.call(payload, 'categoryId')
      || Object.prototype.hasOwnProperty.call(payload, 'customCategory');
    if (categoryInputChanged) {
      const nextCategoryId = Object.prototype.hasOwnProperty.call(payload, 'categoryId')
        ? payload.categoryId
        : event.category_id;
      const nextCustomCategory = Object.prototype.hasOwnProperty.call(payload, 'customCategory')
        ? payload.customCategory
        : event.custom_category;
      const category = normalizeCategory(nextCategoryId, nextCustomCategory);
      if (!category) {
        return structuredError(res, 400, 'Category is required.', 'CATEGORY_REQUIRED');
      }
      event.category = category;
      event.category_id = nextCategoryId || null;
      event.custom_category = nextCustomCategory || null;
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const hasExistingPhotosField = Object.prototype.hasOwnProperty.call(req.body, 'existingPhotos');
    const retainedPhotos = hasExistingPhotosField ? normalizeExistingPhotos(req.body.existingPhotos) : null;
    if (hasExistingPhotosField && !retainedPhotos) {
      return structuredError(res, 400, 'Existing photos payload is invalid.', 'INVALID_EXISTING_PHOTOS');
    }

    if (files.length || hasExistingPhotosField) {
      const oldPublicIds = (event.photos || [])
        .map((photo) => photo.public_id)
        .filter(Boolean);
      const uploadedPhotos = files.map((file) => ({
        url: file.path,
        public_id: file.filename ?? null,
      }));
      const photos = [
        ...(hasExistingPhotosField ? retainedPhotos : (files.length ? [] : (event.photos || []))),
        ...uploadedPhotos,
      ];
      const coverPhotoIndex = photos.length
        ? Math.min(payload.coverPhotoIndex ?? event.cover_photo_index ?? 0, photos.length - 1)
        : 0;
      event.photos = photos;
      event.cover_photo_index = coverPhotoIndex;
      event.image = photos[coverPhotoIndex]?.url ?? null;
      event.image_public_id = photos[coverPhotoIndex]?.public_id ?? null;
      const nextPublicIds = new Set(photos.map((photo) => photo.public_id).filter(Boolean));
      oldPublicIds.forEach((publicId) => {
        if (!nextPublicIds.has(publicId)) {
          deleteFromCloudinary(publicId).catch((e) =>
            console.warn('[updateCatchup] cloudinary cleanup failed', e)
          );
        }
      });
    } else if (payload.coverPhotoIndex !== undefined && Array.isArray(event.photos) && event.photos.length) {
      const coverPhotoIndex = Math.min(payload.coverPhotoIndex, event.photos.length - 1);
      event.cover_photo_index = coverPhotoIndex;
      event.image = event.photos[coverPhotoIndex]?.url ?? null;
      event.image_public_id = event.photos[coverPhotoIndex]?.public_id ?? null;
    }

    await event.save();
    if (event.conversation) {
      await Conversation.findByIdAndUpdate(event.conversation, { name: event.title }).catch((e) =>
        console.warn('[updateCatchup] conversation name update failed', e)
      );
    }

    await event.populate('organizer', 'username avatar is_online last_seen');
    await event.populate('attendees', 'username avatar');

    res.json({
      id: String(event._id),
      status: event.status,
      updatedAt: event.updated_at,
      event: serializeEvent(event, req.user._id, { viewer: req.user, req }),
    });
  } catch (err) {
    console.error('[updateCatchup]', err);
    structuredError(res, 500, 'Internal server error.', 'INTERNAL_ERROR');
  }
}

async function deleteCatchup(req, res) {
  try {
    const event = await loadEditableCatchup(req, res, 'delete');
    if (!event) return;

    event.status = 'cancelled';
    event.deleted_at = new Date();
    await event.save();

    // TODO: notify attendees when the notification fan-out worker exists.
    res.json({ deleted: true });
  } catch (err) {
    console.error('[deleteCatchup]', err);
    structuredError(res, 500, 'Internal server error.', 'INTERNAL_ERROR');
  }
}

async function leaveEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'username avatar is_online last_seen');
    if (!event || isEventDeleted(event)) {
      return structuredError(res, 404, 'Catchup not found.', 'CATCHUP_NOT_FOUND');
    }
    if (isEventCompleted(event)) {
      return structuredError(res, 400, 'Completed catchups cannot be changed.', 'EVENT_COMPLETED');
    }
    if (String(event.organizer?._id ?? event.organizer) === String(req.user._id)) {
      return structuredError(res, 400, 'Hosts cannot leave their own catchup.', 'HOST_CANNOT_LEAVE');
    }

    const wasJoined = event.attendees.some((id) => String(id) === String(req.user._id));
    if (wasJoined) {
      event.attendees = event.attendees.filter((id) => String(id) !== String(req.user._id));
      await event.save();
    }

    const conversation = event.conversation ? await Conversation.findById(event.conversation) : null;
    if (conversation) {
      conversation.participants = conversation.participants.filter((id) => String(id) !== String(req.user._id));
      await conversation.save();
    }

    await event.populate('attendees', 'username avatar');

    res.json({
      event: serializeEvent(event, req.user._id, { viewer: req.user, req }),
      conversation_id: event.conversation ? String(event.conversation) : null,
    });
  } catch (err) {
    console.error('[leaveEvent]', err);
    structuredError(res, 500, 'Internal server error.', 'INTERNAL_ERROR');
  }
}

module.exports = {
  nearbyEvents,
  listEvents,
  serializeEvent,
  createEvent,
  createCatchup,
  updateCatchup,
  getEvent,
  joinEvent,
  leaveEvent,
  deleteEvent,
  deleteCatchup,
  locationSearch,
  parseGoogleMaps,
  listCategories,
  _feedInternals: {
    FEED_RADIUS_M,
    normalizeCity,
    normalizeFeedFilter,
    requestedDateRange,
    requestedStart,
    buildFeedScopeQuery,
    buildFeedQuery,
    eventMatchesFeedScope,
    isEventCompleted,
    eventDistanceMeters,
    popularityMetrics,
    comparePopularEvents,
    buildFeedSort,
  },
};
