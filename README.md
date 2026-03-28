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
- `/api/notifications/*`
- `/api/token/refresh/`
- WebSocket `GET /ws?token=<JWT>` (same host/port as HTTP) for realtime chat events

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

If you are testing on a physical device, set `EXPO_PUBLIC_API_URL` in [`mobile/.env.example`](./mobile/.env.example) to your machine IP or hosted API URL. For production HTTPS APIs, set **`EXPO_PUBLIC_WS_URL`** to the matching secure WebSocket URL (e.g. `wss://api.example.com/ws`) so chat updates arrive in realtime.

#### No Expo account required

You can develop and run the app **without** signing up for Expo or linking the project anywhere:

- Run `npx expo start` and use **Expo Go** (you can proceed anonymously when prompted) or an emulator.
- **Chat in realtime** uses your backend **WebSocket** (`/ws`), not Expo’s servers.
- **Local notifications** (e.g. new message while you’re on another screen) can still work if the user allows notifications; the app **does not crash** if remote push is unavailable.

**Optional later:** If you create an Expo account and want push delivered through Expo’s service, you can set `EAS_PROJECT_ID` in `mobile/.env` (see `.env.example`) and use EAS builds. That is **not** required for local development or for WebSocket chat.

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
- Chat uses **HTTP** for send/history and a **WebSocket** (`/ws`) to deliver new messages to connected clients; optional **Expo push** (`EXPO_ACCESS_TOKEN` on the server) notifies recipients when the app is not in the foreground.
- **Push:** Without an Expo account / EAS project id, **remote** push via Expo is skipped by design; the app still runs. **Local** notifications for new chat (while the app is open) can work with OS permission. For store builds you can use `npx expo prebuild` and open the native projects locally, or adopt EAS later if you want Expo-hosted builds and push.

