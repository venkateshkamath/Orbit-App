const { Event, Conversation, Message, EVENT_CATEGORIES } = require('../models');
const { deleteFromCloudinary } = require('../utils/media');

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
    latitude:      e.latitude,
    longitude:     e.longitude,
    category:      e.category,
    image_url:     e.image ?? null,
    attendee_count: Array.isArray(e.attendees) ? e.attendees.length : 0,
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
        latitude:      e.latitude,
        longitude:     e.longitude,
        distance_m:    Math.round(e.distance_m),
        category:      e.category,
        image_url:     e.image ?? null,
        attendee_count: Array.isArray(e.attendees) ? e.attendees.length : 0,
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
    const { title, description, start_at, end_at, location_name, latitude, longitude, category } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'title is required.' });
    if (!description?.trim()) return res.status(400).json({ error: 'description is required.' });
    if (!start_at)       return res.status(400).json({ error: 'start_at is required.' });
    if (!location_name?.trim()) return res.status(400).json({ error: 'location_name is required.' });
    if (!category || !EVENT_CATEGORIES.includes(category))
      return res.status(400).json({ error: `category must be one of: ${EVENT_CATEGORIES.join(', ')}.` });

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return res.status(400).json({ error: 'latitude and longitude are required.' });

    const startDate = new Date(start_at);
    if (isNaN(startDate.getTime()))
      return res.status(400).json({ error: 'start_at must be a valid date.' });

    const event = await Event.create({
      title:         title.trim(),
      description:   description.trim(),
      organizer:     req.user._id,
      start_at:      startDate,
      end_at:        end_at ? new Date(end_at) : null,
      location_name: location_name?.trim() ?? '',
      location:      { type: 'Point', coordinates: [lng, lat] },
      latitude:      lat,
      longitude:     lng,
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

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&addressdetails=0`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ORBIT-App/1.0 (proximity social)' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return res.json([]);

    const data = await response.json();
    const results = data.map((item) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));

    res.json(results);
  } catch (err) {
    console.error('[locationSearch]', err);
    res.json([]);
  }
}

module.exports = { nearbyEvents, listEvents, createEvent, getEvent, joinEvent, deleteEvent, locationSearch };
