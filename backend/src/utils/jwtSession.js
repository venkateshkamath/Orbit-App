const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const { Session } = require('../models');

function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId), type: 'access' }, env.JWT_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_MINUTES}m`,
  });
}

function signRefreshToken(sessionId, userId, refreshTokenId) {
  return jwt.sign(
    { sub: String(userId), sid: String(sessionId), jti: refreshTokenId, type: 'refresh' },
    env.JWT_SECRET,
    { expiresIn: `${env.REFRESH_TOKEN_DAYS}d` }
  );
}

async function createSession(userId) {
  const refreshTokenId = uuidv4();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    user: userId,
    refresh_token_id: refreshTokenId,
    expires_at: expiresAt,
  });
  return {
    access: signAccessToken(userId),
    refresh: signRefreshToken(session._id, userId, refreshTokenId),
  };
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  createSession,
};
