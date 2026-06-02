const { serializeEvent, _feedInternals } = require('../controllers/eventsController');

const {
  FEED_RADIUS_M,
  buildFeedQuery,
  buildFeedSort,
  comparePopularEvents,
  eventMatchesFeedScope,
  normalizeCity,
} = _feedInternals;

function user(overrides = {}) {
  return {
    _id: 'viewer-1',
    city: 'Kathmandu',
    latitude: 27.7172,
    longitude: 85.324,
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    _id: 'event-1',
    title: 'Smoke Break',
    description: '',
    organizer: 'host-1',
    start_at: new Date('2026-05-31T12:00:00.000Z'),
    end_at: null,
    location_name: 'Kathmandu',
    latitude: 27.7176,
    longitude: 85.325,
    city: 'Kathmandu',
    category: 'social',
    max_people: 10,
    attendees: [],
    photos: [],
    status: 'live',
    created_at: new Date('2026-05-30T12:00:00.000Z'),
    ...overrides,
  };
}

describe('catchups feed helpers', () => {
  test('normalizes city values for local scope matching', () => {
    expect(normalizeCity('  New   Delhi  ')).toBe('new delhi');
  });

  test('matches feed scope by 20km radius, city, or organizer ownership', () => {
    const viewer = user();

    expect(eventMatchesFeedScope(event({ city: 'Lalitpur' }), viewer, FEED_RADIUS_M)).toBe(true);
    expect(eventMatchesFeedScope(event({
      city: ' Kathmandu ',
      latitude: 28.7,
      longitude: 86.1,
    }), viewer, FEED_RADIUS_M)).toBe(true);
    expect(eventMatchesFeedScope(event({
      organizer: viewer._id,
      city: 'Pokhara',
      latitude: 28.2,
      longitude: 83.99,
    }), viewer, FEED_RADIUS_M)).toBe(true);
    expect(eventMatchesFeedScope(event({
      city: 'Pokhara',
      latitude: 28.2,
      longitude: 83.99,
    }), viewer, FEED_RADIUS_M)).toBe(false);
  });

  test('builds literal date ranges for today and week filters', () => {
    const viewer = user();
    const start = new Date('2026-05-31T00:00:00.000+05:45');
    const end = new Date('2026-05-31T23:59:59.999+05:45');

    const today = buildFeedQuery({
      user: viewer,
      filter: 'today',
      clientRange: { start, end },
      now: new Date('2026-05-31T06:00:00.000Z'),
    });
    const week = buildFeedQuery({
      user: viewer,
      filter: 'week',
      clientRange: { start, end },
      now: new Date('2026-05-31T06:00:00.000Z'),
    });

    expect(today.start_at).toEqual({ $gte: start, $lte: end });
    expect(week.start_at).toEqual({ $gte: start, $lte: end });
  });

  test('uses client local day start for near and popular filters when supplied', () => {
    const start = new Date('2026-05-31T00:00:00.000+05:45');
    const now = new Date('2026-05-31T06:00:00.000Z');

    const near = buildFeedQuery({ user: user(), filter: 'near', clientStart: start, now });
    const popular = buildFeedQuery({ user: user(), filter: 'popular', clientStart: start, now });

    expect(near.start_at).toEqual({ $gte: start });
    expect(popular.start_at).toEqual({ $gte: start });
  });

  test('orders popular catchups by joins, fill ratio, then soonness', () => {
    const now = new Date('2026-05-31T06:00:00.000Z');
    const manyJoins = event({ attendees: ['a', 'b', 'c'], max_people: 10, start_at: new Date('2026-05-31T20:00:00.000Z') });
    const fewerJoins = event({ attendees: ['a', 'b'], max_people: 2, start_at: new Date('2026-05-31T07:00:00.000Z') });
    const fuller = event({ attendees: ['a', 'b'], max_people: 4, start_at: new Date('2026-06-02T06:00:00.000Z') });
    const lessFull = event({ attendees: ['a', 'b'], max_people: 10, start_at: new Date('2026-05-31T07:00:00.000Z') });
    const soon = event({ attendees: ['a'], max_people: 10, start_at: new Date('2026-05-31T07:00:00.000Z') });
    const later = event({ attendees: ['a'], max_people: 10, start_at: new Date('2026-06-04T07:00:00.000Z') });

    expect(comparePopularEvents(manyJoins, fewerJoins, now)).toBeLessThan(0);
    expect(comparePopularEvents(fuller, lessFull, now)).toBeLessThan(0);
    expect(comparePopularEvents(soon, later, now)).toBeLessThan(0);
  });

  test('sorts near feed by distance before start time when viewer location exists', () => {
    expect(buildFeedSort('near', true)).toEqual({
      is_completed_sort: 1,
      is_today_sort: -1,
      distance_missing_sort: 1,
      distance_sort_m: 1,
      start_at: 1,
    });
    expect(buildFeedSort('near', false)).toEqual({
      is_completed_sort: 1,
      is_today_sort: -1,
      start_at: 1,
    });
  });

  test('serializes completed state using end time when present, otherwise start time', () => {
    const now = new Date('2026-05-31T06:00:00.000Z');
    const completed = serializeEvent(event({
      start_at: new Date('2026-05-31T04:00:00.000Z'),
      end_at: null,
    }), 'viewer-1', { now });
    const stillRunning = serializeEvent(event({
      start_at: new Date('2026-05-31T04:00:00.000Z'),
      end_at: new Date('2026-05-31T07:00:00.000Z'),
    }), 'viewer-1', { now });

    expect(completed.is_completed).toBe(true);
    expect(stillRunning.is_completed).toBe(false);
  });
});
