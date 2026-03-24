const { Conversation, Message, MessageReaction } = require('../models');
const { fullMediaUrl } = require('../utils/media');
const { serializePublicUser } = require('./user');

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
  serializeConversation,
};
