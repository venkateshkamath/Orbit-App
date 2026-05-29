const { z } = require('zod');
const { Event, Conversation, Message, EVENT_CATEGORIES } = require('../models');
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

function serializeEvent(event, requestingUserId) {
  const e = event.toObject ? event.toObject() : event;
  return {
    id:            String(e._id),
    title:         e.title,
    description:   e.description,
    organizer: e.organizer
      ? {
          id:       String(e.organizer._id ?? e.organizer),
          username: e.organizer.username ?? null,
          avatar:   e.organizer.avatar   ?? null,
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
    image_url:     e.image ?? null,
    photos: Array.isArray(e.photos) && e.photos.length
      ? e.photos.map((photo) => ({ url: photo.url, public_id: photo.public_id ?? null }))
      : (e.image ? [{ url: e.image, public_id: e.image_public_id ?? null }] : []),
    cover_photo_index: e.cover_photo_index ?? 0,
    status:        e.status ?? 'live',
    attendee_count: Array.isArray(e.attendees) ? e.attendees.length : 0,
    spots_left: Math.max((e.max_people ?? 10) - (Array.isArray(e.attendees) ? e.attendees.length : 0), 0),
    conversation_id: e.conversation ? String(e.conversation) : null,
    has_joined: requestingUserId
      ? Array.isArray(e.attendees) && e.attendees.some((id) => String(id) === String(requestingUserId))
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
          query:         { start_at: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
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
      events: events.map((e) => ({
        id:            String(e._id),
        title:         e.title,
        description:   e.description,
        organizer: e.organizer
          ? { id: String(e.organizer._id), username: e.organizer.username, avatar: e.organizer.avatar ?? null }
          : null,
        start_at:      e.start_at,
        end_at:        e.end_at ?? null,
        location_name: e.location_name,
        address:       e.address ?? '',
        city:          e.city ?? '',
        location_source: e.location_source ?? 'legacy',
        latitude:      e.latitude,
        longitude:     e.longitude,
        distance_m:    Math.round(e.distance_m),
        category:      e.category,
        category_id:   e.category_id ?? null,
        custom_category: e.custom_category ?? null,
        join_mode:     e.join_mode ?? 'open',
        max_people:    e.max_people ?? 10,
        image_url:     e.image ?? null,
        photos: Array.isArray(e.photos) && e.photos.length
          ? e.photos.map((photo) => ({ url: photo.url, public_id: photo.public_id ?? null }))
          : (e.image ? [{ url: e.image, public_id: e.image_public_id ?? null }] : []),
        cover_photo_index: e.cover_photo_index ?? 0,
        status:        e.status ?? 'live',
        attendee_count: Array.isArray(e.attendees) ? e.attendees.length : 0,
        spots_left: Math.max((e.max_people ?? 10) - (Array.isArray(e.attendees) ? e.attendees.length : 0), 0),
        conversation_id: e.conversation ? String(e.conversation) : null,
        has_joined: Array.isArray(e.attendees) && e.attendees.some((id) => String(id) === String(req.user._id)),
        is_own: String(e.organizer?._id ?? e.organizer) === String(req.user._id),
        created_at:    e.created_at,
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
    res.status(201).json(serializeEvent(event, req.user._id));
  } catch (err) {
    console.error('[createEvent]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── GET /api/events/feed ───────────────────────────────────────── */

async function listEvents(req, res) {
  try {
    const now = new Date();
    const events = await Event.find({
      start_at: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    })
      .sort({ start_at: 1 })
      .limit(80)
      .populate('organizer', 'username avatar')
      .exec();

    res.json({
      count: events.length,
      results: events.map((event) => serializeEvent(event, req.user._id)),
    });
  } catch (err) {
    console.error('[listEvents]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── GET /api/events/:id ─────────────────────────────────────────── */

async function getEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'username avatar');
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json(serializeEvent(event, req.user._id));
  } catch (err) {
    console.error('[getEvent]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

/* ── POST /api/events/:id/join ─────────────────────────────────── */

async function joinEvent(req, res) {
  try {
    const event = await Event.findById(req.params.id).populate('organizer', 'username avatar');
    if (!event) return res.status(404).json({ error: 'Event not found.' });

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

    const alreadyJoined = event.attendees.some((id) => String(id) === String(req.user._id));
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

    res.json({
      event: serializeEvent(event, req.user._id),
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
      event: serializeEvent(event, req.user._id),
    });
  } catch (err) {
    console.error('[createCatchup]', err);
    structuredError(res, 500, 'Internal server error.', 'INTERNAL_ERROR');
  }
}

module.exports = {
  nearbyEvents,
  listEvents,
  createEvent,
  createCatchup,
  getEvent,
  joinEvent,
  deleteEvent,
  locationSearch,
  parseGoogleMaps,
  listCategories,
};
