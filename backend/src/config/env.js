const path = require('path');
const dotenv = require('dotenv');

const ROOT_DIR = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const env = {
  ROOT_DIR,
  PORT: Number(process.env.PORT || 8000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  ACCESS_TOKEN_MINUTES: Number(process.env.JWT_ACCESS_TOKEN_LIFETIME_MINUTES || 60),
  REFRESH_TOKEN_DAYS: Number(process.env.JWT_REFRESH_TOKEN_LIFETIME_DAYS || 7),
  CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mindlink',
};

module.exports = env;
