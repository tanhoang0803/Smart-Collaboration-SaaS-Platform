import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('accessToken');
    socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:8080', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(tenantId: string) {
  const s = getSocket();
  s.connect();
  s.emit('join-tenant', { tenantId });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function onTaskEvent(
  event: 'task.created' | 'task.updated' | 'task.deleted' | 'task.ai_suggestion_ready',
  handler: (payload: unknown) => void,
) {
  getSocket().on(event, handler);
  return () => { getSocket().off(event, handler); };
}
