const { User } = require('../models');

/**
 * One-shot sync: scalar lat/lng ↔ GeoJSON for existing rows (Mongo $geoNear needs `location`).
 */
async function backfillUserGeoLocations() {
  await User.updateMany(
    { $or: [{ latitude: null }, { longitude: null }] },
    { $unset: { location: 1 } }
  );
  // If `location_updated_at` stays null, discoveryService’s $geoNear `query` never matches ($gte vs null).
  await User.updateMany(
    { latitude: { $ne: null }, longitude: { $ne: null } },
    [
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [{ $toDouble: '$longitude' }, { $toDouble: '$latitude' }],
          },
          location_updated_at: { $ifNull: ['$location_updated_at', '$$NOW'] },
        },
      },
    ]
  );
}

module.exports = { backfillUserGeoLocations };
