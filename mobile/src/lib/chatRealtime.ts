/**
 * WebSocket client for chat `new_message` events (backend /ws?token=...).
 */

import { AppState, type AppStateStatus, Platform } from 'react-native';
import { WS_BASE_URL, getStoredAccessToken } from '../api/client';

export type ChatNewMessagePayload = {
  type: 'new_message';
  conversation_id: string;
  message_id: string;
  sender_id: string;
  sender_username?: string;
  preview: string;
};

type Listener = (payload: ChatNewMessagePayload) => void;

const listeners = new Set<Listener>();

export function subscribeChatNewMessage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(payload: ChatNewMessagePayload) {
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {
      /* ignore subscriber errors */
    }
  });
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let intentionalClose = false;
let appStateSub: { remove: () => void } | null = null;

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function buildWsUrl(token: string): string {
  const base = WS_BASE_URL.replace(/\/$/, '');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

function connectOnce() {
  if (Platform.OS === 'web') return;

  clearReconnectTimer();

  void (async () => {
    const token = await getStoredAccessToken();
    if (intentionalClose) return;
    if (!token) {
      scheduleReconnect();
      return;
    }
    if (intentionalClose) return;

    try {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
      socket = null;
      if (intentionalClose) return;
      socket = new WebSocket(buildWsUrl(token));
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      if (__DEV__) {
        console.log('[chatRealtime] WebSocket connected', WS_BASE_URL);
      }
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as ChatNewMessagePayload;
        if (data?.type === 'new_message' && data.conversation_id) {
          emit({
            ...data,
            conversation_id: String(data.conversation_id),
          });
        }
      } catch {
        /* ignore */
      }
    };

    socket.onerror = (e) => {
      if (__DEV__) {
        console.warn('[chatRealtime] WebSocket error', e);
      }
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    };

    socket.onclose = (ev) => {
      if (__DEV__) {
        console.warn('[chatRealtime] WebSocket closed', ev?.code, ev?.reason);
      }
      socket = null;
      if (!intentionalClose) {
        scheduleReconnect();
      }
    };
  })();
}

function scheduleReconnect() {
  clearReconnectTimer();
  if (intentionalClose || Platform.OS === 'web') return;
  reconnectTimer = setTimeout(() => connectOnce(), 2500);
}

/** Start socket when authenticated; no-op on web. */
export function startChatRealtime() {
  if (Platform.OS === 'web') return;

  intentionalClose = false;
  connectOnce();

  if (!appStateSub) {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && !intentionalClose) {
        try {
          socket?.close();
        } catch {
          /* ignore */
        }
        socket = null;
        connectOnce();
      }
    };
    appStateSub = AppState.addEventListener('change', onChange);
  }
}

export function stopChatRealtime() {
  intentionalClose = true;
  clearReconnectTimer();
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  socket = null;
}

export function teardownChatRealtime() {
  stopChatRealtime();
  appStateSub?.remove();
  appStateSub = null;
  listeners.clear();
}
