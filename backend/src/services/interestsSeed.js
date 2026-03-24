const { Interest } = require('../models');

const defaultInterests = [
  ['Technology', '💻', 'career', '#2563EB'],
  ['Design', '🎨', 'career', '#DB2777'],
  ['Startups', '🚀', 'career', '#EA580C'],
  ['Music', '🎵', 'creative', '#059669'],
  ['Travel', '✈️', 'lifestyle', '#D97706'],
  ['Food', '🍜', 'lifestyle', '#EF4444'],
];

async function ensureInterests() {
  const count = await Interest.countDocuments({});
  if (count === 0) {
    for (const [name, emoji, category, color] of defaultInterests) {
      await Interest.create({ name, emoji, category, color });
    }
  }
}

module.exports = { ensureInterests };
