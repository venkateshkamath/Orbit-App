/**
 * Keep MongoDB GeoJSON `location` in sync with scalar latitude/longitude for geo queries.
 * Coordinates are [longitude, latitude] per GeoJSON.
 * @param {import('mongoose').Document} user
 */
function syncUserGeoPoint(user) {
  const lat = user.latitude;
  const lng = user.longitude;
  if (
    lat != null &&
    lng != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng))
  ) {
    user.set('location', {
      type: 'Point',
      coordinates: [Number(lng), Number(lat)],
    });
  } else {
    user.set('location', undefined);
  }
}

module.exports = { syncUserGeoPoint };
