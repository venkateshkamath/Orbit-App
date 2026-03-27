const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { User, OtpChallenge } = require('../models');
const { sendOtpEmail } = require('../services/otpEmail');
const { createSession } = require('../utils/jwtSession');
const { serializeUser } = require('../serializers/user');

const OTP_EXPIRES_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const RESEND_MIN_MS = 60 * 1000;

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function sendOtp(req, res) {
  const { email, purpose, username, date_of_birth } = req.body || {};
  const em = normalizeEmail(email);

  if (!em || !/\S+@\S+\.\S+/.test(em)) {
    res.status(400).json({ email: ['Enter a valid email address.'] });
    return;
  }
  if (purpose !== 'signup' && purpose !== 'login') {
    res.status(400).json({ detail: 'Invalid purpose.' });
    return;
  }

  if (purpose === 'signup') {
    const name = String(username || '').trim();
    const dob = String(date_of_birth || '').trim();
    if (name.length < 2) {
      res.status(400).json({ username: ['Please enter your name (at least 2 characters).'] });
      return;
    }
    if (name.length > 80) {
      res.status(400).json({ username: ['Name is too long.'] });
      return;
    }
    if (!dob) {
      res.status(400).json({ date_of_birth: ['Date of birth is required.'] });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      res.status(400).json({ date_of_birth: ['Use YYYY-MM-DD format.'] });
      return;
    }
    if (await User.findOne({ email: em })) {
      res.status(400).json({ email: ['An account with this email already exists.'] });
      return;
    }
    if (await User.findOne({ username: new RegExp(`^${escapeRegex(name)}$`, 'i') })) {
      res.status(400).json({
        username: ['This name is already in use. Try a variation or add your last name.'],
      });
      return;
    }
  } else {
    const existing = await User.findOne({ email: em });
    if (!existing) {
      res.status(200).json({
        message: 'If an account exists for this email, a code was sent.',
        expires_in: Math.floor(OTP_EXPIRES_MS / 1000),
      });
      return;
    }
  }

  const last = await OtpChallenge.findOne({ email: em, purpose }).sort({ created_at: -1 });
  if (last && Date.now() - last.created_at.getTime() < RESEND_MIN_MS) {
    res.status(429).json({ detail: 'Please wait a minute before requesting another code.' });
    return;
  }

  await OtpChallenge.deleteMany({ email: em, purpose });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MS);

  await OtpChallenge.create({
    email: em,
    purpose,
    code_hash: codeHash,
    expires_at: expiresAt,
    attempts: 0,
    username: purpose === 'signup' ? String(username).trim() : null,
    date_of_birth: purpose === 'signup' ? String(date_of_birth).trim() : null,
  });

  await sendOtpEmail(em, code, purpose);

  const payload = {
    message:
      purpose === 'signup'
        ? 'Verification code sent to your email.'
        : 'If an account exists for this email, a code was sent.',
    expires_in: Math.floor(OTP_EXPIRES_MS / 1000),
  };
  if (env.OTP_DEBUG_RESPONSE) {
    payload.debug_otp = code;
  }
  res.status(200).json(payload);
}

async function verifyOtp(req, res) {
  const { email, code, purpose } = req.body || {};
  const em = normalizeEmail(email);
  const rawCode = String(code || '').replace(/\s/g, '');

  if (!em || !rawCode || (purpose !== 'signup' && purpose !== 'login')) {
    res.status(400).json({ detail: 'Email, code, and purpose are required.' });
    return;
  }
  if (!/^\d{6}$/.test(rawCode)) {
    res.status(400).json({ code: ['Enter the 6-digit code.'] });
    return;
  }

  const challenge = await OtpChallenge.findOne({ email: em, purpose }).sort({ created_at: -1 });
  if (!challenge) {
    res.status(400).json({ detail: 'No verification code found. Request a new code.' });
    return;
  }
  if (challenge.expires_at.getTime() < Date.now()) {
    await OtpChallenge.deleteOne({ _id: challenge._id });
    res.status(400).json({ detail: 'This code has expired. Request a new one.' });
    return;
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    await OtpChallenge.deleteOne({ _id: challenge._id });
    res.status(400).json({ detail: 'Too many attempts. Request a new code.' });
    return;
  }

  const match = await bcrypt.compare(rawCode, challenge.code_hash);
  if (!match) {
    challenge.attempts += 1;
    await challenge.save();
    res.status(400).json({ detail: 'Invalid code. Please try again.' });
    return;
  }

  await OtpChallenge.deleteOne({ _id: challenge._id });

  if (purpose === 'signup') {
    let user;
    try {
      user = await User.create({
        email: em,
        username: challenge.username,
        date_of_birth: challenge.date_of_birth,
        password_hash: null,
        is_verified: true,
      });
    } catch (err) {
      if (err.code === 11000) {
        res.status(400).json({
          detail: 'Could not create account. Email or name may already be in use.',
        });
        return;
      }
      throw err;
    }
    const tokens = await createSession(user._id);
    res.status(201).json({
      user: await serializeUser(user, req),
      tokens,
    });
    return;
  }

  const user = await User.findOne({ email: em });
  if (!user) {
    res.status(400).json({ detail: 'No account found. Please sign up first.' });
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

module.exports = {
  sendOtp,
  verifyOtp,
};
