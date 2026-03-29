const { User, Match, Conversation, Message, UserBlock, Like, Pass } = require('../models');
const { asNumber } = require('../utils/validation');
const {
  isConversationParticipant,
  findConversationBetweenUsers,
  serializeMessage,
  serializeMessagesList,
  serializeConversation,
} = require('../serializers/chat');
const { broadcastToUser } = require('../realtime/chatWsHub');
const { notifyChatMessageRecipient } = require('../services/notificationService');

/**
 * @param {import('mongoose').Types.ObjectId|string} conversationId
 * @param {import('mongoose').Document} messageDoc
 * @param {{ _id: import('mongoose').Types.ObjectId|string, username?: string }} senderUser
 * @param {object|null} serializedMessage
 */
async function relayNewMessageToParticipants(
  conversationId,
  messageDoc,
  senderUser,
  req,
  serializedMessage = null
) {
  const conv = await Conversation.findById(conversationId).select('participants').lean().exec();
  if (!conv) return;
  const preview = String(messageDoc.content || '').slice(0, 200);
  const messageJson = serializedMessage || (await serializeMessage(messageDoc, req));
  const payload = {
    type: 'new_message',
    conversation_id: String(conversationId),
    message_id: String(messageDoc._id),
    sender_id: String(senderUser._id),
    sender_username: senderUser.username,
    preview,
    message: messageJson,
  };
  const recipients = conv.participants.filter((pid) => String(pid) !== String(senderUser._id));
  await Promise.allSettled(
    recipients.map(async (pid) => {
      const recipientId = String(pid);
      broadcastToUser(recipientId, payload);
      await notifyChatMessageRecipient(pid, senderUser, String(conversationId), preview);
    })
  );
}

function relayInBackground(promise) {
  promise.catch((err) => {
    console.warn('Chat relay skipped:', err.message);
  });
}

async function getBlockStateBetweenUsers(userId, otherUserId) {
  if (!otherUserId) {
    return { isBlocked: false, blockedByMe: false, blockedByOther: false };
  }
  const [blockedByMeRow, blockedByOtherRow] = await Promise.all([
    UserBlock.findOne({ blocker: userId, blocked: otherUserId }).select('_id').lean(),
    UserBlock.findOne({ blocker: otherUserId, blocked: userId }).select('_id').lean(),
  ]);
  const blockedByMe = Boolean(blockedByMeRow);
  const blockedByOther = Boolean(blockedByOtherRow);
  return { isBlocked: blockedByMe || blockedByOther, blockedByMe, blockedByOther };
}

function findOtherParticipantId(conversationOrParticipants, userId) {
  const participants = Array.isArray(conversationOrParticipants)
    ? conversationOrParticipants
    : conversationOrParticipants?.participants || [];
  const other = participants.find((pid) => String(pid) !== String(userId));
  return other || null;
}

async function getConversationForParticipant(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId).select('participants').lean();
  const isParticipant =
    conversation?.participants?.some((pid) => String(pid) === String(userId)) || false;
  if (!conversation || !isParticipant) return null;
  return conversation;
}

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
  const blockState = await getBlockStateBetweenUsers(req.user._id, otherUser._id);
  if (blockState.isBlocked) {
    res.status(403).json({
      code: 'chat_blocked',
      detail: blockState.blockedByOther
        ? 'You are blocked and cannot send messages.'
        : 'You blocked this user. Unblock to send messages.',
    });
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
    const senderUser = await User.findById(req.user._id).select('_id username').lean();
    if (senderUser) {
      relayInBackground(relayNewMessageToParticipants(conversation._id, message, senderUser, req));
    }
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
    .populate({
      path: 'sender',
      populate: { path: 'interest_ids', model: 'Interest' },
    })
    .lean();
  const results = await serializeMessagesList(messageRows, req);
  res.json({
    count: results.length,
    next: null,
    previous: null,
    results,
  });
}

async function sendMessage(req, res) {
  const conversation = await getConversationForParticipant(req.params.id, req.user._id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const otherParticipantId = findOtherParticipantId(conversation, req.user._id);
  const blockState = await getBlockStateBetweenUsers(req.user._id, otherParticipantId);
  if (blockState.isBlocked) {
    res.status(403).json({
      code: 'chat_blocked',
      detail: blockState.blockedByOther
        ? 'You are blocked and cannot send messages.'
        : 'You blocked this user. Unblock to send messages.',
    });
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
  const serializedMessage = await serializeMessage(message, req);
  const senderUser = await User.findById(req.user._id).select('_id username').lean();
  if (senderUser) {
    relayInBackground(
      relayNewMessageToParticipants(req.params.id, message, senderUser, req, serializedMessage)
    );
  }
  res.status(201).json(serializedMessage);
}

async function clearConversation(req, res) {
  const conversation = await getConversationForParticipant(req.params.id, req.user._id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const result = await Message.deleteMany({ conversation: req.params.id });

  const payload = {
    type: 'conversation_cleared',
    conversation_id: String(req.params.id),
  };
  for (const pid of conversation.participants) {
    broadcastToUser(pid, payload);
  }

  res.json({
    message: 'Chat cleared for both users.',
    deleted_count: result.deletedCount || 0,
  });
}

async function blockConversationUser(req, res) {
  const conversation = await getConversationForParticipant(req.params.id, req.user._id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const otherParticipantId = findOtherParticipantId(conversation, req.user._id);
  if (!otherParticipantId) {
    res.status(400).json({ error: 'Cannot block in this conversation.' });
    return;
  }

  await UserBlock.updateOne(
    { blocker: req.user._id, blocked: otherParticipantId },
    {
      $setOnInsert: {
        blocker: req.user._id,
        blocked: otherParticipantId,
      },
    },
    { upsert: true }
  );

  const sortedIds = [String(req.user._id), String(otherParticipantId)].sort();
  await Promise.all([
    Match.deleteOne({ user1: sortedIds[0], user2: sortedIds[1] }),
    Like.deleteMany({
      $or: [
        { from_user: req.user._id, to_user: otherParticipantId },
        { from_user: otherParticipantId, to_user: req.user._id },
      ],
    }),
    Pass.deleteMany({
      $or: [
        { from_user: req.user._id, to_user: otherParticipantId },
        { from_user: otherParticipantId, to_user: req.user._id },
      ],
    }),
  ]);

  res.json({
    message: 'User blocked. They can view this chat but cannot send messages.',
    blocked_user_id: String(otherParticipantId),
  });
}

async function unblockConversationUser(req, res) {
  const conversation = await getConversationForParticipant(req.params.id, req.user._id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const otherParticipantId = findOtherParticipantId(conversation, req.user._id);
  if (!otherParticipantId) {
    res.status(400).json({ error: 'Cannot unblock in this conversation.' });
    return;
  }
  await UserBlock.deleteOne({ blocker: req.user._id, blocked: otherParticipantId });
  res.json({
    message: 'User unblocked. You can send messages again.',
    unblocked_user_id: String(otherParticipantId),
  });
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

  const conversation = await getConversationForParticipant(
    String(message.conversation),
    req.user._id
  );
  if (conversation) {
    const payload = {
      type: 'message_deleted',
      conversation_id: String(message.conversation),
      message_id: String(message._id),
    };
    for (const pid of conversation.participants) {
      broadcastToUser(pid, payload);
    }
  }

  res.json({ message: 'Deleted' });
}

module.exports = {
  listConversations,
  getConversation,
  startConversation,
  listMessages,
  sendMessage,
  clearConversation,
  blockConversationUser,
  unblockConversationUser,
  markRead,
  deleteMessage,
};
