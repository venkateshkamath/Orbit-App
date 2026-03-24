/**
 * Chat Store - State management for conversations and messages
 */

import { create } from 'zustand';
import { Conversation, Message } from '../types';
import { chatApi } from '../api';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isSending: boolean;
  lastError?: string | null;
  
  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  startConversation: (userId: string, message?: string) => Promise<Conversation>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (message: Message) => void;
  markAsRead: (conversationId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  isSending: false,
  lastError: null,

  fetchConversations: async () => {
    set({ isLoading: true, lastError: null });
    try {
      const response = await chatApi.getConversations();
      set({ conversations: response.results || [], isLoading: false });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      set({ isLoading: false, lastError: 'Failed to load conversations.' });
    }
  },

  fetchMessages: async (conversationId) => {
    set({ isLoading: true, lastError: null });
    try {
      const response = await chatApi.getMessages(conversationId);
      // Reverse to show oldest first in the chat
      set({ messages: (response.results || []).reverse(), isLoading: false });
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({ isLoading: false, lastError: 'Failed to load messages.' });
    }
  },

  sendMessage: async (conversationId, content) => {
    set({ isSending: true, lastError: null });
    try {
      const message = await chatApi.sendMessage(conversationId, content);
      set((state) => ({
        messages: [...state.messages, message],
        isSending: false,
      }));
    } catch (error) {
      console.error('Failed to send message:', error);
      set({ isSending: false, lastError: 'Failed to send message.' });
    }
  },

  startConversation: async (userId, message) => {
    try {
      const conversation = await chatApi.startConversation(userId, message);
      set((state) => ({
        conversations: [conversation, ...state.conversations.filter((c) => c.id !== conversation.id)],
        lastError: null,
      }));
      return conversation;
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      const apiMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Unable to start conversation.';
      set({ lastError: apiMessage });
      throw error;
    }
  },

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation, messages: [] });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  markAsRead: async (conversationId) => {
    try {
      await chatApi.markAsRead(conversationId);
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },
}));

export default useChatStore;
