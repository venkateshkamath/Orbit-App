/**
 * Deletes all user data from the DB (users, sessions, OTPs, likes, matches,
 * passes, posts, comments, conversations, messages, reactions, notifications,
 * events). Keeps Interest seed data intact.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collections = [
    'users',
    'sessions',
    'otpchallenges',
    'userblocks',
    'likes',
    'matches',
    'passes',
    'posts',
    'postlikes',
    'comments',
    'conversations',
    'messages',
    'messagereactions',
    'notifications',
    'events',
  ];

  for (const col of collections) {
    const result = await db.collection(col).deleteMany({});
    console.log(`  ${col}: deleted ${result.deletedCount}`);
  }

  console.log('\nDone. Interests left intact.');
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
