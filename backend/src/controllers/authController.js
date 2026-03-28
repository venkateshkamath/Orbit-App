const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Interest, Session } = require('../models');
const { passwordValidation } = require('../utils/validation');
const { signAccessToken } = require('../utils/jwtSession');

async function logout(req, res) {
  const refresh = req.body?.refresh;
  if (refresh) {
    try {
      const payload = jwt.verify(refresh, env.JWT_SECRET);
      if (payload.type === 'refresh' && payload.sid) {
        await Session.deleteOne({ _id: payload.sid });
      }
    } catch (error) {
      // ignore
    }
  }

  req.user.is_online = false;
  req.user.last_seen = new Date();
  await req.user.save();

  res.json({ message: 'Successfully logged out' });
}

async function refreshToken(req, res) {
  const refresh = req.body?.refresh;
  if (!refresh) {
    res.status(400).json({ detail: 'Refresh token is required.' });
    return;
  }

  try {
    const payload = jwt.verify(refresh, env.JWT_SECRET);
    if (payload.type !== 'refresh' || !payload.sid || !payload.sub || !payload.jti) {
      throw new Error('Invalid refresh token');
    }

    const session = await Session.findById(payload.sid);
    if (!session || String(session.user) !== String(payload.sub) || session.refresh_token_id !== payload.jti) {
      throw new Error('Session mismatch');
    }

    if (session.expires_at.getTime() < Date.now()) {
      await Session.deleteOne({ _id: session._id });
      throw new Error('Session expired');
    }

    res.json({ access: signAccessToken(payload.sub) });
  } catch (error) {
    res.status(401).json({ detail: 'Invalid or expired refresh token.' });
  }
}

async function changePassword(req, res) {
  const { old_password = '', new_password = '' } = req.body || {};
  if (!req.user.password_hash) {
    res.status(400).json({
      detail: 'This account uses email codes to sign in. Password change is not available.',
    });
    return;
  }
  const matches = await bcrypt.compare(old_password, req.user.password_hash);
  if (!matches) {
    res.status(400).json({ old_password: ['Current password is incorrect'] });
    return;
  }

  const validationErrors = passwordValidation(new_password);
  if (validationErrors.length) {
    res.status(400).json({ new_password: validationErrors });
    return;
  }

  req.user.password_hash = await bcrypt.hash(new_password, 10);
  await req.user.save();
  res.json({ message: 'Password changed successfully' });
}

async function listInterests(req, res) {
  const interests = await Interest.find({}).sort({ category: 1, name: 1 });
  res.json(
    interests.map((interest) => ({
      id: String(interest._id),
      name: interest.name,
      emoji: interest.emoji,
      category: interest.category,
      color: interest.color,
    }))
  );
}

module.exports = {
  logout,
  refreshToken,
  changePassword,
  listInterests,
};
