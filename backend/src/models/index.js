const mongoose = require('mongoose');

const interestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    emoji: { type: String, required: true },
    category: { type: String, required: true },
    color: { type: String, required: true },
  },
  { timestamps: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    password_hash: { type: String, default: null },
    bio: { type: String, default: '' },
    avatar: { type: String, default: null },
    date_of_birth: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    /** GeoJSON Point for $geoNear discovery queries; synced from latitude/longitude. */
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: { type: [Number] },
    },
    location_updated_at: { type: Date, default: null },
    is_discoverable: { type: Boolean, default: true },
    discovery_radius: { type: Number, default: 1000 },
    show_online_status: { type: Boolean, default: true },
    is_online: { type: Boolean, default: false },
    last_seen: { type: Date, default: null },
    is_verified: { type: Boolean, default: false },
    interest_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Interest' }],
    /** Expo push token for remote notifications (optional). */
    expo_push_token: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
userSchema.index({ location: '2dsphere' }, { sparse: true });

const otpChallengeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    purpose: { type: String, enum: ['signup', 'login'], required: true },
    code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    username: { type: String, default: null },
    date_of_birth: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
otpChallengeSchema.index({ email: 1, purpose: 1 });

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    refresh_token_id: { type: String, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const userBlockSchema = new mongoose.Schema(
  {
    blocker: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    blocked: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const likeSchema = new mongoose.Schema(
  {
    from_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
likeSchema.index({ from_user: 1, to_user: 1 }, { unique: true });

const matchSchema = new mongoose.Schema(
  {
    user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
matchSchema.index({ user1: 1, user2: 1 }, { unique: true });

const passSchema = new mongoose.Schema(
  {
    from_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to_user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
passSchema.index({ from_user: 1, to_user: 1 }, { unique: true });

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caption: { type: String, default: '' },
    image: { type: String, default: null },
    location_name: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    interest_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Interest' }],
    privacy: {
      type: String,
      enum: ['public', 'connections', 'private'],
      default: 'public',
    },
    mediaPublicId: {
      type: String,
      default: null,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
postSchema.index({ privacy: 1, author: 1 });
postSchema.index({ author: 1, created_at: -1 });

const postLikeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
postLikeSchema.index({ user: 1, post: 1 }, { unique: true });

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    text: { type: String, required: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message_type: { type: String, default: 'text' },
    content: { type: String, required: true },
    image: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    is_read: { type: Boolean, default: false },
    read_at: { type: Date, default: null },
    is_deleted: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const messageReactionSchema = new mongoose.Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
messageReactionSchema.index({ message: 1, user: 1 }, { unique: true });

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['orbit_join', 'message', 'match'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    read_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);
notificationSchema.index({ recipient: 1, created_at: -1 });

const EVENT_CATEGORIES = ['music', 'sports', 'food', 'arts', 'tech', 'social', 'outdoors', 'wellness', 'education', 'gaming'];

const eventSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    organizer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_at:    { type: Date, required: true },
    end_at:      { type: Date, default: null },
    location_name: { type: String, default: '' },
    location: {
      type:        { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    latitude:  { type: Number, required: true },
    longitude: { type: Number, required: true },
    category: {
      type: String,
      enum: EVENT_CATEGORIES,
      required: true,
    },
    image:          { type: String, default: null },
    image_public_id: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
eventSchema.index({ location: '2dsphere' });
eventSchema.index({ organizer: 1, created_at: -1 });
eventSchema.index({ start_at: 1 });

module.exports = {
  EVENT_CATEGORIES,
  Event: mongoose.model('Event', eventSchema),
  Interest: mongoose.model('Interest', interestSchema),
  User: mongoose.model('User', userSchema),
  OtpChallenge: mongoose.model('OtpChallenge', otpChallengeSchema),
  Session: mongoose.model('Session', sessionSchema),
  UserBlock: mongoose.model('UserBlock', userBlockSchema),
  Like: mongoose.model('Like', likeSchema),
  Match: mongoose.model('Match', matchSchema),
  Pass: mongoose.model('Pass', passSchema),
  Post: mongoose.model('Post', postSchema),
  PostLike: mongoose.model('PostLike', postLikeSchema),
  Comment: mongoose.model('Comment', commentSchema),
  Conversation: mongoose.model('Conversation', conversationSchema),
  Message: mongoose.model('Message', messageSchema),
  MessageReaction: mongoose.model('MessageReaction', messageReactionSchema),
  Notification: mongoose.model('Notification', notificationSchema),
};
