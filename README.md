# ORBIT

ORBIT is a proximity-based social app with an Expo mobile client and a Node.js backend.

## Stack

- Mobile: React Native with Expo
- Backend: Node.js + Express
- Database: MongoDB (local or hosted)
- Auth: JWT access + refresh tokens; sign-up / sign-in use **email OTP**
- Storage: local media in development, object storage/CDN recommended for production

## Backend

The backend lives in `backend` as an Express service backed by MongoDB. It preserves the existing `/api` contract used by the mobile app:

- `/api/auth/*`
- `/api/users/*`
- `/api/discover/*`
- `/api/posts/*`
- `/api/chat/*`
- `/api/token/refresh/`

It uses:

- `mongodb://localhost:27017/mindlink` for local development
- Any MongoDB-compatible cloud database (MongoDB Atlas, Render, etc.) in production via `MONGODB_URI`

## Local Setup

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API will start on `http://localhost:8000`.

#### OTP email (real inboxes)

OTP codes are emailed when you configure **either** [Resend](https://resend.com) **or** SMTP in `backend/.env` (see `backend/.env.example`).

- **Resend (recommended):** set `RESEND_API_KEY`, verify domain `joinorbit.org` in the Resend dashboard, and optionally `MAIL_FROM=ORBIT <hello@joinorbit.org>` (this is the default if unset).
- **SMTP:** set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and matching `MAIL_FROM` / `SMTP_FROM`.

If neither is configured, the server still issues OTPs but only logs them to the terminal (and in development may return `debug_otp` in the API).

Check SMTP login without running the API: `cd backend && npm run test:smtp`.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

If you are testing on a physical device, set `EXPO_PUBLIC_API_URL` in [`mobile/.env.example`](./mobile/.env.example) to your machine IP or hosted API URL.

## Cloud Recommendation

For this app, the simplest efficient production shape is:

1. Node API on Render, Railway, or Fly.io
2. Database on MongoDB Atlas (or another managed Mongo-compatible service)
3. Media on S3-compatible object storage

## Production Env

```env
PORT=8000
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://your-mobile-web-app.example.com
MONGODB_URI=mongodb+srv://user:pass@cluster0.mongodb.net/mindlink
JWT_SECRET=replace-this
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=7
RESEND_API_KEY=re_xxxx
MAIL_FROM=ORBIT <hello@joinorbit.org>
OTP_DEBUG_RESPONSE=false
```

## Notes

- The backend has been rebuilt from scratch on Node.js + MongoDB.
- The service seeds a basic set of interests automatically on startup if none exist.
- Chat is HTTP-based; there is no websocket dependency in this codebase.

