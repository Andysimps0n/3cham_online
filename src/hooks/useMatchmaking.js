import { useCallback, useEffect, useRef, useState } from 'react';

const USER_ID_STORAGE_KEY = 'neo_user_id';

function avatarColorFromId(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 65%)`;
}

function createFallbackUserId() {
  return `neo_${Math.random().toString(36).substring(2, 8)}`;
}

export function useMatchmaking({ nickname, onMatchConnected, onMatchIncoming, onMatchSent, onMatchError, onMatchDeclined, onPeerLandmarks }) {
  const [userId, setUserId] = useState(() => localStorage.getItem(USER_ID_STORAGE_KEY) || null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [isWaitingForPeer, setIsWaitingForPeer] = useState(false);
  const [waitingTargetId, setWaitingTargetId] = useState('');
  const [matchedSession, setMatchedSession] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const callbacksRef = useRef({
    onMatchConnected,
    onMatchIncoming,
    onMatchSent,
    onMatchError,
    onMatchDeclined,
    onPeerLandmarks,
  });

  useEffect(() => {
    callbacksRef.current = {
      onMatchConnected,
      onMatchIncoming,
      onMatchSent,
      onMatchError,
      onMatchDeclined,
      onPeerLandmarks,
    };
  }, [onMatchConnected, onMatchIncoming, onMatchSent, onMatchError, onMatchDeclined, onPeerLandmarks]);

  const registerUser = useCallback(async (nextNickname) => {
    const storedId = localStorage.getItem(USER_ID_STORAGE_KEY);
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: storedId || undefined,
        nickname: nextNickname,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register user');
    }

    const data = await response.json();
    localStorage.setItem(USER_ID_STORAGE_KEY, data.userId);
    setUserId(data.userId);
    return data.userId;
  }, []);

  const connectSocket = useCallback((registeredUserId, nextNickname) => {
    const userIdForSocket = registeredUserId || localStorage.getItem(USER_ID_STORAGE_KEY) || createFallbackUserId();
    localStorage.setItem(USER_ID_STORAGE_KEY, userIdForSocket);
    setUserId(userIdForSocket);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsSocketConnected(true);
      ws.send(JSON.stringify({
        type: 'register',
        userId: userIdForSocket,
        nickname: nextNickname,
      }));
    };

    ws.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (message.type) {
        case 'registered':
          setUserId(message.userId);
          localStorage.setItem(USER_ID_STORAGE_KEY, message.userId);
          break;
        case 'match:incoming':
          setPendingInvite({
            inviteId: message.inviteId,
            fromId: message.fromId,
            fromNickname: message.fromNickname,
          });
          callbacksRef.current.onMatchIncoming?.(message);
          break;
        case 'match:sent':
          setIsWaitingForPeer(true);
          setWaitingTargetId(message.targetId);
          callbacksRef.current.onMatchSent?.(message);
          break;
        case 'match:connected': {
          const session = {
            roomId: message.roomId,
            peer: {
              id: message.peer.id,
              nickname: message.peer.nickname,
              avatarColor: message.peer.avatarColor || avatarColorFromId(message.peer.id),
            },
          };
          setIsWaitingForPeer(false);
          setWaitingTargetId('');
          setPendingInvite(null);
          setMatchedSession(session);
          callbacksRef.current.onMatchConnected?.(session);
          break;
        }
        case 'match:declined':
          setIsWaitingForPeer(false);
          setWaitingTargetId('');
          setPendingInvite(null);
          setMatchedSession(null);
          callbacksRef.current.onMatchDeclined?.(message);
          break;
        case 'match:error':
          setIsWaitingForPeer(false);
          setWaitingTargetId('');
          setPendingInvite(null);
          callbacksRef.current.onMatchError?.(message.message);
          break;
        case 'landmarks:peer':
          callbacksRef.current.onPeerLandmarks?.(message);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      setIsSocketConnected(false);
      reconnectTimerRef.current = window.setTimeout(() => {
        connectSocket(userIdForSocket, nextNickname);
      }, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      let registeredId = localStorage.getItem(USER_ID_STORAGE_KEY);

      try {
        registeredId = await registerUser(nickname);
      } catch (error) {
        console.warn('HTTP user register unavailable, falling back to WebSocket registration.', error);
        if (!registeredId) {
          registeredId = createFallbackUserId();
          localStorage.setItem(USER_ID_STORAGE_KEY, registeredId);
          setUserId(registeredId);
        }
      }

      if (!cancelled) {
        connectSocket(registeredId, nickname);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectSocket, registerUser]);

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !userId) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'register',
      userId,
      nickname,
    }));
  }, [nickname, userId]);

  const sendMatchRequest = useCallback((targetId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      callbacksRef.current.onMatchError?.('Not connected to matchmaking server.');
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: 'match:request',
      targetId: targetId.trim().toLowerCase(),
    }));
    return true;
  }, []);

  const acceptInvite = useCallback((inviteId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      callbacksRef.current.onMatchError?.('Not connected to matchmaking server.');
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: 'match:accept',
      inviteId,
    }));
    return true;
  }, []);

  const declineInvite = useCallback((inviteId) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: 'match:decline',
      inviteId,
    }));
    setPendingInvite(null);
    return true;
  }, []);

  const cancelWaiting = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'match:cancel' }));
    }
    setIsWaitingForPeer(false);
    setWaitingTargetId('');
  }, []);

  const sendPeerLandmarks = useCallback((landmarks) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false;
    }

    if (!Array.isArray(landmarks) || landmarks.length === 0) {
      return false;
    }

    const isOrientationPacket = landmarks.length === 12;
    const isFullMesh = landmarks.length % 3 === 0 && landmarks.length <= 468 * 3;
    if (!isOrientationPacket && !isFullMesh) {
      return false;
    }

    wsRef.current.send(JSON.stringify({
      type: 'landmarks:send',
      landmarks,
    }));
    return true;
  }, []);

  const sendMatchLeave = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'match:leave' }));
    }
    setMatchedSession(null);
    setIsWaitingForPeer(false);
    setWaitingTargetId('');
  }, []);

  const copyUserId = useCallback(async () => {
    if (!userId) return false;
    try {
      await navigator.clipboard.writeText(userId);
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  return {
    userId,
    isSocketConnected,
    pendingInvite,
    isWaitingForPeer,
    waitingTargetId,
    matchedSession,
    sendMatchRequest,
    acceptInvite,
    declineInvite,
    cancelWaiting,
    sendPeerLandmarks,
    clearMatchedSession: () => setMatchedSession(null),
    sendMatchLeave,
    copyUserId,
  };
}
