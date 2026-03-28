const { Notification, User } = require('../models');

/**
 * @param {import('mongoose').Types.ObjectId} recipientId
 * @param {import('mongoose').Document} actorUser
 */
async function notifyOrbitJoinRecipient(recipientId, actorUser) {
  await Notification.create({
    recipient: recipientId,
    type: 'orbit_join',
    title: 'Join orbit request',
    body: `${actorUser.username} wants to join your orbit.`,
    payload: { actor_id: String(actorUser._id) },
  });

  const recipient = await User.findById(recipientId).select('expo_push_token username');
  if (!recipient?.expo_push_token) {
    return;
  }

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { Expo } = require('expo-server-sdk');
    const expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    });
    if (!Expo.isExpoPushToken(recipient.expo_push_token)) {
      return;
    }
    await expo.sendPushNotificationsAsync([
      {
        to: recipient.expo_push_token,
        sound: 'default',
        title: 'Join orbit request',
        body: `${actorUser.username} wants to join your orbit.`,
        data: { type: 'orbit_join', actor_id: String(actorUser._id) },
      },
    ]);
  } catch (err) {
    console.warn('Expo push skipped:', err.message);
  }
}

/**
 * @param {import('mongoose').Types.ObjectId} recipientId
 * @param {import('mongoose').Document} senderUser
 * @param {string} conversationId
 * @param {string} preview
 */
async function notifyChatMessageRecipient(recipientId, senderUser, conversationId, preview) {
  await Notification.create({
    recipient: recipientId,
    type: 'message',
    title: senderUser.username || 'New message',
    body: preview || 'Sent you a message',
    payload: {
      conversation_id: conversationId,
      sender_id: String(senderUser._id),
    },
  });

  const recipient = await User.findById(recipientId).select('expo_push_token username');
  if (!recipient?.expo_push_token) {
    return;
  }

  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const { Expo } = require('expo-server-sdk');
    const expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    });
    if (!Expo.isExpoPushToken(recipient.expo_push_token)) {
      return;
    }
    await expo.sendPushNotificationsAsync([
      {
        to: recipient.expo_push_token,
        sound: 'default',
        title: senderUser.username || 'New message',
        body: preview || 'Sent you a message',
        data: {
          type: 'message',
          conversation_id: conversationId,
          sender_id: String(senderUser._id),
        },
      },
    ]);
  } catch (err) {
    console.warn('Expo push (chat) skipped:', err.message);
  }
}

module.exports = {
  notifyOrbitJoinRecipient,
  notifyChatMessageRecipient,
};
