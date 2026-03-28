/**
 * Subscribes to chat WebSocket, syncs TanStack Query, and shows local notifications
 * when a message arrives while the user is not viewing that conversation.
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
import { subscribeChatNewMessage, startChatRealtime, stopChatRealtime } from '../lib/chatRealtime';
import type { ChatNewMessagePayload } from '../lib/chatRealtime';

function isViewingConversationPath(pathname: string, conversationId: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/';
  return p === `/chat/${conversationId}`;
}

export function ChatRealtimeBridge() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isOnboardingComplete } = useAuthStore();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

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
    return subscribeChatNewMessage((payload: ChatNewMessagePayload) => {
      const conversationId = String(payload.conversation_id);
      qc.invalidateQueries({ queryKey: orbitKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
      qc.invalidateQueries({ queryKey: orbitKeys.conversation(conversationId) });
      qc.invalidateQueries({ queryKey: orbitKeys.notifications() });

      const onThisChat = isViewingConversationPath(pathnameRef.current, conversationId);
      if (onThisChat) return;

      const title = payload.sender_username?.trim() || 'New message';
      const body = payload.preview?.trim() || 'Sent you a message';

      void tryScheduleLocalNotification({
        title,
        body,
        data: { conversationId, type: 'chat_message' },
      });
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
