const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
    if (payload.type !== 'access' || !payload.sub) {
      throw new Error('Invalid token');
    }
    const user = await User.findById(payload.sub);
    if (!user) {
      res.status(401).json({ detail: 'User not found.' });
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ detail: 'Invalid or expired token.' });
  }
}

module.exports = { authMiddleware };
