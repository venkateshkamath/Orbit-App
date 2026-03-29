/**
 * Merge a WebSocket-delivered message into TanStack Query caches without refetching
 * the full thread (same idea as iMessage / WhatsApp live delivery).
 */

import type { QueryClient } from '@tanstack/react-query';
import type { Conversation, Message } from '../types';
import { orbitKeys } from '../hooks/orbitKeys';

export function applyRealtimeChatMessage(
  qc: QueryClient,
  conversationId: string,
  message: Message,
  onThisChat: boolean
) {
  qc.setQueryData<Message[]>(orbitKeys.messages(conversationId), (old) => {
    const list = old ?? [];
    if (list.some((m) => m.id === message.id)) return list;
    return [...list, message];
  });

  const convs = qc.getQueryData<Conversation[]>(orbitKeys.conversations());
  const convInList = convs?.some((c) => c.id === conversationId) ?? false;

  qc.setQueryData<Conversation[]>(orbitKeys.conversations(), (old) => {
    if (!old?.length) return old;
    const idx = old.findIndex((c) => c.id === conversationId);
    if (idx === -1) return old;
    const next = [...old];
    const c = next[idx];
    const unread = onThisChat ? 0 : c.unread_count + 1;
    next[idx] = {
      ...c,
      last_message: message,
      updated_at: message.created_at,
      unread_count: unread,
    };
    return next.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  });

  if (!convInList) {
    void qc.invalidateQueries({ queryKey: orbitKeys.conversations() });
  }

  qc.setQueryData<Conversation | undefined>(orbitKeys.conversation(conversationId), (old) => {
    if (!old) return old;
    return {
      ...old,
      last_message: message,
      updated_at: message.created_at,
      unread_count: onThisChat ? 0 : old.unread_count + 1,
    };
  });
}
