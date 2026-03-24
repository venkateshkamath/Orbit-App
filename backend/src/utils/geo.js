function haversineDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function matchPercentage(userInterestIds, otherInterestIds) {
  const a = new Set(userInterestIds.map(String));
  const b = new Set(otherInterestIds.map(String));
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  const intersection = [...a].filter((value) => b.has(value));
  const union = new Set([...a, ...b]);
  return Math.round((intersection.length / union.size) * 100);
}

module.exports = {
  haversineDistance,
  matchPercentage,
};
