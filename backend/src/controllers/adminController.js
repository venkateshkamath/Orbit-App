const mongoose = require('mongoose');
const env = require('../config/env');
const {
  User,
  Session,
  UserBlock,
  Like,
  Match,
  Pass,
  Post,
  PostLike,
  Comment,
  Conversation,
  Message,
  MessageReaction,
} = require('../models');

async function health(req, res) {
  const dbState = mongoose.connection.readyState;
  res.json({ ok: dbState === 1, database: 'mongodb' });
}

async function devReset(req, res) {
  if (env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not allowed in production' });
    return;
  }

  try {
    await Promise.all([
      User.deleteMany({}),
      Session.deleteMany({}),
      UserBlock.deleteMany({}),
      Like.deleteMany({}),
      Match.deleteMany({}),
      Pass.deleteMany({}),
      Post.deleteMany({}),
      PostLike.deleteMany({}),
      Comment.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      MessageReaction.deleteMany({}),
    ]);

    res.json({ ok: true, message: 'Development data reset complete.' });
  } catch (error) {
    console.error('Dev reset failed', error);
    res.status(500).json({ error: 'Failed to reset data' });
  }
}

module.exports = {
  health,
  devReset,
};
