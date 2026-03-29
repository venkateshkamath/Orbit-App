/**
 * Chat API endpoints
 */

import api from './client';
import { Conversation, Message } from '../types';

export const chatApi = {
  getConversations: async (): Promise<{ results: Conversation[] }> => {
    const response = await api.get('/chat/conversations/');
    return response.data;
  },

  getConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await api.get(`/chat/conversations/${conversationId}/`);
    return response.data;
  },

  startConversation: async (userId: string, message?: string): Promise<Conversation> => {
    const response = await api.post('/chat/conversations/start/', {
      user_id: userId,
      message,
    });
    return response.data;
  },

  getMessages: async (conversationId: string): Promise<{ results: Message[] }> => {
    const response = await api.get(`/chat/conversations/${conversationId}/messages/`);
    return response.data;
  },

  sendMessage: async (
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' | 'location' = 'text',
    extra?: { latitude?: number; longitude?: number }
  ): Promise<Message> => {
    const response = await api.post(`/chat/conversations/${conversationId}/messages/send/`, {
      content,
      message_type: messageType,
      ...extra,
    });
    return response.data;
  },

  markAsRead: async (conversationId: string): Promise<void> => {
    await api.post(`/chat/conversations/${conversationId}/messages/read/`);
  },

  clearConversation: async (
    conversationId: string
  ): Promise<{ message: string; deleted_count: number }> => {
    const response = await api.post(`/chat/conversations/${conversationId}/clear/`);
    return response.data;
  },

  blockConversationUser: async (
    conversationId: string
  ): Promise<{ message: string; blocked_user_id: string }> => {
    const response = await api.post(`/chat/conversations/${conversationId}/block/`);
    return response.data;
  },

  unblockConversationUser: async (
    conversationId: string
  ): Promise<{ message: string; unblocked_user_id: string }> => {
    const response = await api.post(`/chat/conversations/${conversationId}/unblock/`);
    return response.data;
  },

  deleteMessage: async (messageId: string): Promise<void> => {
    await api.delete(`/chat/messages/${messageId}/delete/`);
  },
};

export default chatApi;
