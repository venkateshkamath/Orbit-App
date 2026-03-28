const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** @type {Map<string, Set<import('ws').WebSocket>>} */
const socketsByUserId = new Map();

function addSocket(userId, ws) {
  const id = String(userId);
  let set = socketsByUserId.get(id);
  if (!set) {
    set = new Set();
    socketsByUserId.set(id, set);
  }
  set.add(ws);
}

function removeSocket(userId, ws) {
  const id = String(userId);
  const set = socketsByUserId.get(id);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    socketsByUserId.delete(id);
  }
}

/**
 * Push a JSON payload to all sockets for this user (multiple devices).
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {Record<string, unknown>} payload
 */
function broadcastToUser(userId, payload) {
  const id = String(userId);
  const set = socketsByUserId.get(id);
  if (!set || set.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of [...set]) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch {
        removeSocket(id, ws);
      }
    } else {
      removeSocket(id, ws);
    }
  }
}

function extractTokenFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return null;
  const params = new URLSearchParams(url.slice(qIndex + 1));
  return params.get('token');
}

/**
 * @param {import('http').Server} server
 */
function attachChatWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost';
    let pathname;
    try {
      pathname = new URL(request.url || '/', `http://${host}`).pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = extractTokenFromUrl(request.url || '');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (payload.type !== 'access' || !payload.sub) {
        throw new Error('Invalid token');
      }
      userId = String(payload.sub);
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      addSocket(userId, ws);
      ws.on('close', () => {
        removeSocket(userId, ws);
      });
      ws.on('error', () => {
        removeSocket(userId, ws);
      });
    });
  });

  /**
   * Light keepalive only. React Native's WebSocket often does not answer ws `ping` with `pong`
   * the way the `ws` library expects, so terminating "stale" clients was dropping valid sockets.
   */
  const interval = setInterval(() => {
    for (const [, set] of socketsByUserId) {
      for (const ws of [...set]) {
        if (ws.readyState !== WebSocket.OPEN) continue;
        try {
          ws.ping();
        } catch {
          /* ignore */
        }
      }
    }
  }, 60_000);

  server.on('close', () => {
    clearInterval(interval);
  });
}

module.exports = {
  attachChatWs,
  broadcastToUser,
};
