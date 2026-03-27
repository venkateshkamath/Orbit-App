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
  // In development, include OTP in JSON so the app works without reading server logs.
  // Set OTP_DEBUG_RESPONSE=false to disable. In production, only true if explicitly set.
  OTP_DEBUG_RESPONSE:
    process.env.OTP_DEBUG_RESPONSE === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.OTP_DEBUG_RESPONSE !== 'false'),
  /** Shown as From: for OTP mail (Resend + SMTP). Verify this domain in your provider. */
  MAIL_FROM: process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.RESEND_FROM || 'ORBIT <hello@joinorbit.org>',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_SECURE: process.env.SMTP_SECURE || 'false',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: (process.env.SMTP_PASS || '').trim(),
  SMTP_FROM: process.env.SMTP_FROM || '',
};

module.exports = env;
