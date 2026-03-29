/**
 * Subscribes to chat WebSocket, syncs TanStack Query caches for:
 *   - new_message: append message to thread
 *   - message_deleted: remove message from thread
 *   - conversation_cleared: empty the thread
 * Also shows local notifications for incoming messages.
 */

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import {
  addNotificationResponseListenerSafe,
  tryScheduleLocalNotification,
} from '../lib/notificationsSafe';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores';
import { orbitKeys } from '../hooks/orbitKeys';
import { API_BASE_URL, WS_BASE_URL } from '../api/client';
import { subscribeChatEvents, startChatRealtime, stopChatRealtime } from '../lib/chatRealtime';
import type { ChatRealtimeEvent } from '../lib/chatRealtime';
import { applyRealtimeChatMessage } from '../lib/applyRealtimeChatMessage';
import type { Message, Conversation } from '../types';

function isViewingConversationPath(pathname: string, conversationId: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === `/chat/${conversationId}`;
}

export function ChatRealtimeBridge() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isOnboardingComplete, user } = useAuthStore();
  const pathnameRef = useRef(pathname);
  const userIdRef = useRef<string | undefined>(undefined);
  pathnameRef.current = pathname;
  userIdRef.current = user?.id;

  useEffect(() => {
    if (!isAuthenticated || !isOnboardingComplete || Platform.OS === 'web') {
      stopChatRealtime();
      return undefined;
    }
    if (__DEV__) {
      console.log('[ChatRealtimeBridge] API', API_BASE_URL, '| WS', WS_BASE_URL);
    }
    startChatRealtime();
    return () => {
      stopChatRealtime();
    };
  }, [isAuthenticated, isOnboardingComplete]);

  useEffect(() => {
    return subscribeChatEvents((event: ChatRealtimeEvent) => {
      if (event.type === 'new_message') {
        const conversationId = String(event.conversation_id);
        const onThisChat = isViewingConversationPath(pathnameRef.current, conversationId);
        const selfId = userIdRef.current;
        const isOwnEcho =
          Boolean(selfId) && String(event.sender_id) === String(selfId);

        if (event.message) {
          applyRealtimeChatMessage(qc, conversationId, event.message, onThisChat);
        } else if (!(onThisChat && isOwnEcho)) {
          qc.invalidateQueries({ queryKey: orbitKeys.messages(conversationId) });
          qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
          void qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
        }

        qc.invalidateQueries({ queryKey: orbitKeys.notifications() });

        if (onThisChat) return;

        const title = event.sender_username?.trim() || 'New message';
        const body = event.preview?.trim() || 'Sent you a message';

        void tryScheduleLocalNotification({
          title,
          body,
          data: { conversationId, type: 'chat_message' },
        });
        return;
      }

      if (event.type === 'message_deleted') {
        const conversationId = String(event.conversation_id);
        const messageId = String(event.message_id);

        qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), (old) => {
          if (!old) return old;
          return old.filter((m) => m.id !== messageId);
        });

        qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
        qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
        return;
      }

      if (event.type === 'conversation_cleared') {
        const conversationId = String(event.conversation_id);

        qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), []);

        qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
        qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
        return;
      }
    });
  }, [qc]);

  useEffect(() => {
    const openChatFromData = (data: Record<string, unknown> | undefined) => {
      const cid =
        typeof data?.conversationId === 'string'
          ? data.conversationId
          : typeof data?.conversation_id === 'string'
            ? data.conversation_id
            : null;
      if (!cid) return;
      const type = data?.type;
      if (type === 'orbit_join') return;
      router.push(`/chat/${cid}`);
    };

    const sub = addNotificationResponseListenerSafe((data) => {
      openChatFromData(data);
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
