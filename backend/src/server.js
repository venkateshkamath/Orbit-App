const env = require('./config/env');
const { connectDb } = require('./config/db');
const { ensureInterests } = require('./services/interestsSeed');
const { createApp } = require('./app');

async function start() {
  try {
    await connectDb();
    await ensureInterests();
    const app = createApp();
    app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`MindLink backend (Mongo) listening on http://0.0.0.0:${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
