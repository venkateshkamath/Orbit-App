const { User, Match, Conversation, Message } = require('../models');
const { asNumber } = require('../utils/validation');
const {
  isConversationParticipant,
  findConversationBetweenUsers,
  serializeMessage,
  serializeConversation,
} = require('../serializers/chat');

async function listConversations(req, res) {
  const conversationRows = await Conversation.find({
    participants: req.user._id,
  })
    .sort({ updated_at: -1 })
    .exec();

  const results = [];
  for (const conversation of conversationRows) {
    results.push(await serializeConversation(conversation, req.user._id, req));
  }

  res.json({
    count: results.length,
    next: null,
    previous: null,
    results,
  });
}

async function getConversation(req, res) {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation || !(await isConversationParticipant(conversation._id, req.user._id))) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json(await serializeConversation(conversation, req.user._id, req));
}

async function startConversation(req, res) {
  const userId = req.body?.user_id;
  const messageText = String(req.body?.message || '').trim();
  const otherUser = await User.findById(userId);
  if (!otherUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const sortedIds = [String(req.user._id), String(otherUser._id)].sort();
  const existingMatch = await Match.findOne({
    user1: sortedIds[0],
    user2: sortedIds[1],
  });
  if (!existingMatch) {
    res.status(403).json({ detail: 'You can only start a chat with people you have matched with.' });
    return;
  }

  let conversation = await findConversationBetweenUsers(req.user._id, otherUser._id);
  let createdConversation = false;
  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, otherUser._id],
    });
    createdConversation = true;
  }

  if (messageText) {
    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      message_type: 'text',
      content: messageText,
      latitude: asNumber(req.body?.latitude),
      longitude: asNumber(req.body?.longitude),
    });
    conversation.updated_at = message.created_at;
    await conversation.save();
  }

  res
    .status(createdConversation ? 201 : 200)
    .json(await serializeConversation(conversation, req.user._id, req));
}

async function listMessages(req, res) {
  if (!(await isConversationParticipant(req.params.id, req.user._id))) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const messageRows = await Message.find({
    conversation: req.params.id,
    is_deleted: false,
  })
    .sort({ created_at: -1 })
    .exec();
  const results = [];
  for (const message of messageRows) {
    results.push(await serializeMessage(message, req));
  }
  res.json({
    count: results.length,
    next: null,
    previous: null,
    results,
  });
}

async function sendMessage(req, res) {
  if (!(await isConversationParticipant(req.params.id, req.user._id))) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const content = String(req.body?.content || '').trim();
  if (!content) {
    res.status(400).json({ content: ['This field is required.'] });
    return;
  }
  const message = await Message.create({
    conversation: req.params.id,
    sender: req.user._id,
    message_type: req.body?.message_type || 'text',
    content,
    latitude: asNumber(req.body?.latitude),
    longitude: asNumber(req.body?.longitude),
  });
  await Conversation.updateOne(
    { _id: req.params.id },
    { $set: { updated_at: message.created_at } }
  );
  res.status(201).json(await serializeMessage(message, req));
}

async function markRead(req, res) {
  if (!(await isConversationParticipant(req.params.id, req.user._id))) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const readAt = new Date();
  const result = await Message.updateMany(
    {
      conversation: req.params.id,
      is_deleted: false,
      is_read: false,
      sender: { $ne: req.user._id },
    },
    { $set: { is_read: true, read_at: readAt } }
  );
  res.json({ marked_read: result.modifiedCount || 0 });
}

async function deleteMessage(req, res) {
  const message = await Message.findById(req.params.id);
  if (!message || String(message.sender) !== String(req.user._id)) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }
  message.is_deleted = true;
  await message.save();
  res.json({ message: 'Deleted' });
}

module.exports = {
  listConversations,
  getConversation,
  startConversation,
  listMessages,
  sendMessage,
  markRead,
  deleteMessage,
};
