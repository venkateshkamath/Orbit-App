const http = require('http');
const env = require('./config/env');
const { connectDb } = require('./config/db');
const { User } = require('./models');
const { ensureInterests } = require('./services/interestsSeed');
const { backfillUserGeoLocations } = require('./services/userGeoBackfill');
const { createApp } = require('./app');
const { attachChatWs } = require('./realtime/chatWsHub');

async function start() {
  try {
    await connectDb();
    await ensureInterests();
    await backfillUserGeoLocations();
    await User.syncIndexes();
    const app = createApp();
    const server = http.createServer(app);
    attachChatWs(server);
    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`ORBIT backend (Mongo) listening on http://0.0.0.0:${env.PORT} (HTTP + WS /ws)`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
