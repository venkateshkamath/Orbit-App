const { Conversation, Message, MessageReaction } = require('../models');
const { fullMediaUrl } = require('../utils/media');
const { serializePublicUser, serializePublicUserSync } = require('./user');

async function isConversationParticipant(conversationId, userId) {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
  return !!conversation;
}

function findConversationBetweenUsers(userId, otherUserId) {
  return Conversation.findOne({
    participants: { $all: [userId, otherUserId] },
  });
}

async function serializeMessage(message, req) {
  await message.populate('sender');
  const reactionRows = await MessageReaction.find({ message: message._id });
  return {
    id: String(message._id),
    conversation: String(message.conversation),
    sender: await serializePublicUser(message.sender, req),
    message_type: message.message_type,
    content: message.content,
    image: fullMediaUrl(req, message.image),
    latitude: message.latitude,
    longitude: message.longitude,
    is_read: !!message.is_read,
    read_at: message.read_at ? message.read_at.toISOString() : null,
    reactions: reactionRows.map((row) => ({
      emoji: row.emoji,
      user_id: String(row.user),
    })),
    created_at: message.created_at.toISOString(),
  };
}

/**
 * Batch-serialize many messages: one reaction query + senders pre-populated (e.g. lean + populate).
 */
async function serializeMessagesList(messageRows, req) {
  if (!messageRows.length) return [];
  const ids = messageRows.map((m) => m._id);
  const reactionRows = await MessageReaction.find({ message: { $in: ids } }).lean();
  /** @type {Map<string, { emoji: string, user_id: string }[]>} */
  const byMsg = new Map();
  for (const row of reactionRows) {
    const mid = String(row.message);
    if (!byMsg.has(mid)) byMsg.set(mid, []);
    byMsg.get(mid).push({ emoji: row.emoji, user_id: String(row.user) });
  }
  return messageRows.map((m) => ({
    id: String(m._id),
    conversation: String(m.conversation),
    sender: serializePublicUserSync(m.sender, req),
    message_type: m.message_type,
    content: m.content,
    image: fullMediaUrl(req, m.image),
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
    is_read: !!m.is_read,
    read_at: m.read_at ? new Date(m.read_at).toISOString() : null,
    reactions: byMsg.get(String(m._id)) || [],
    created_at: new Date(m.created_at).toISOString(),
  }));
}

async function serializeConversation(conversation, currentUserId, req) {
  await conversation.populate('participants');
  const participants = [];
  for (const participant of conversation.participants) {
    participants.push(await serializePublicUser(participant, req));
  }
  const other =
    conversation.participants.find((p) => String(p._id) !== String(currentUserId)) || null;
  const lastMessageRow = await Message.findOne({
    conversation: conversation._id,
    is_deleted: false,
  })
    .sort({ created_at: -1 })
    .limit(1);

  const unreadCount = await Message.countDocuments({
    conversation: conversation._id,
    is_deleted: false,
    is_read: false,
    sender: { $ne: currentUserId },
  });

  return {
    id: String(conversation._id),
    participants,
    other_participant: other ? await serializePublicUser(other, req) : null,
    last_message: lastMessageRow ? await serializeMessage(lastMessageRow, req) : null,
    unread_count: unreadCount,
    created_at: conversation.created_at.toISOString(),
    updated_at: conversation.updated_at.toISOString(),
  };
}

module.exports = {
  isConversationParticipant,
  findConversationBetweenUsers,
  serializeMessage,
  serializeMessagesList,
  serializeConversation,
};
