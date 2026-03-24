const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User, Interest, Session } = require('../models');
const { passwordValidation } = require('../utils/validation');
const { createSession, signAccessToken } = require('../utils/jwtSession');
const { serializeUser } = require('../serializers/user');

async function register(req, res) {
  const { email = '', username = '', password = '', password_confirm = '' } = req.body || {};
  const errors = {};

  if (!email.trim()) {
    errors.email = ['This field is required.'];
  } else if (await User.findOne({ email: email.trim().toLowerCase() })) {
    errors.email = ['A user with that email already exists.'];
  }

  if (!username.trim()) {
    errors.username = ['This field is required.'];
  } else if (await User.findOne({ username: new RegExp(`^${username.trim()}$`, 'i') })) {
    errors.username = ['A user with that username already exists.'];
  }

  if (password !== password_confirm) {
    errors.password = ["Passwords don't match"];
  } else {
    const passwordErrors = passwordValidation(password);
    if (passwordErrors.length) {
      errors.password = passwordErrors;
    }
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json(errors);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email: email.trim().toLowerCase(),
    username: username.trim(),
    password_hash: passwordHash,
  });
  const tokens = await createSession(user._id);
  res.status(201).json({
    user: await serializeUser(user, req),
    tokens,
  });
}

async function login(req, res) {
  const { email = '', password = '' } = req.body || {};
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  user.is_online = true;
  user.updated_at = new Date();
  await user.save();

  const tokens = await createSession(user._id);
  res.json({
    user: await serializeUser(user, req),
    tokens,
  });
}

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
  register,
  login,
  logout,
  refreshToken,
  changePassword,
  listInterests,
};
