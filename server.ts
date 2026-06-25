import express, { Request, Response } from "express";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(express.json());

type OnlineUser = {
  userId: string;
  nickname: string;
  socket: WebSocket;
  roomId?: string;
  peerId?: string;
};

type PendingInvite = {
  inviteId: string;
  fromId: string;
  toId: string;
  fromNickname: string;
  createdAt: number;
};

const onlineUsers = new Map<string, OnlineUser>();
const pendingInvites = new Map<string, PendingInvite>();
const outboundInvitesByUser = new Map<string, string>();

// ---------------------------------------------------------------------------
// Attack-Defend game state (server-authoritative)
// ---------------------------------------------------------------------------
// The server owns ONE game per room. Both clients only *report* what their
// player did (nodded, looked left/right); the server is the single source of
// truth for roles, scoring, and role swaps so the two screens can never
// disagree. First player to WIN_SCORE points wins.

const WIN_SCORE = 5;

type GameDirection = "left" | "right";
type GamePhase = "attackerTurn" | "defenderTurn" | "gameOver";

type Game = {
  roomId: string;
  attackerId: string;
  defenderId: string;
  scores: Record<string, number>;
  attackerDirection: GameDirection | null;
  phase: GamePhase;
};

const games = new Map<string, Game>();

/** Send the same game snapshot to both players. They derive their own role
 * from attackerId/defenderId vs. their own userId. */
function broadcastGame(game: Game, extra: Record<string, unknown>) {
  const payload = {
    attackerId: game.attackerId,
    defenderId: game.defenderId,
    scores: game.scores,
    phase: game.phase,
    ...extra,
  };

  const attacker = getOnlineUser(game.attackerId);
  const defender = getOnlineUser(game.defenderId);
  if (attacker) sendSocketMessage(attacker.socket, payload);
  if (defender) sendSocketMessage(defender.socket, payload);
}

function startGameForRoom(roomId: string, userAId: string, userBId: string) {
  const attackerFirst = Math.random() < 0.5;
  const attackerId = attackerFirst ? userAId : userBId;
  const defenderId = attackerFirst ? userBId : userAId;

  const game: Game = {
    roomId,
    attackerId,
    defenderId,
    scores: { [userAId]: 0, [userBId]: 0 },
    attackerDirection: null,
    phase: "attackerTurn",
  };

  games.set(roomId, game);
  broadcastGame(game, { type: "game:start", winScore: WIN_SCORE });
}

function getGameForUser(userId: string): Game | undefined {
  const user = onlineUsers.get(userId);
  if (!user?.roomId) return undefined;
  return games.get(user.roomId);
}

function generateUserId(): string {
  return Math.floor(Math.random() * 100000).toString().padStart(5, '0');
}

function generateInviteId(): string {
  return Math.random().toString(36).substring(2, 12);
}

function generateRoomId(): string {
  return `${Math.random().toString(36).substring(2, 10)}`;
}

function avatarColorFromId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 65%)`;
}

function sendSocketMessage(socket: WebSocket, payload: Record<string, unknown>) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function getOnlineUser(userId: string): OnlineUser | undefined {
  return onlineUsers.get(userId);
}

function normalizeUserId(raw: string): string {
  return raw.trim().toLowerCase();
}

function clearUserMatchState(userId: string) {
  const user = onlineUsers.get(userId);
  if (!user) return;

  // Tear down any in-progress game for this room so a stale game can't linger.
  if (user.roomId) {
    games.delete(user.roomId);
  }

  user.roomId = undefined;
  user.peerId = undefined;

  const outboundInviteId = outboundInvitesByUser.get(userId);
  if (outboundInviteId) {
    pendingInvites.delete(outboundInviteId);
    outboundInvitesByUser.delete(userId);
  }
}

function createPeerMatch(fromUser: OnlineUser, toUser: OnlineUser, inviteId: string) {
  const roomId = generateRoomId();

  fromUser.roomId = roomId;
  fromUser.peerId = toUser.userId;
  toUser.roomId = roomId;
  toUser.peerId = fromUser.userId;

  pendingInvites.delete(inviteId);
  outboundInvitesByUser.delete(fromUser.userId);

  sendSocketMessage(fromUser.socket, {
    type: "match:connected",
    roomId,
    peer: {
      id: toUser.userId,
      nickname: toUser.nickname,
      avatarColor: avatarColorFromId(toUser.userId),
    },
  });

  sendSocketMessage(toUser.socket, {
    type: "match:connected",
    roomId,
    peer: {
      id: fromUser.userId,
      nickname: fromUser.nickname,
      avatarColor: avatarColorFromId(fromUser.userId),
    },
  });

  // Kick off the Attack-Defend game for this freshly-connected pair.
  startGameForRoom(roomId, fromUser.userId, toUser.userId);
}

app.post("/api/users/register", (req: Request, res: Response) => {
  const { userId: existingId, nickname } = req.body ?? {};
  const safeNickname = typeof nickname === "string" && nickname.trim() ? nickname.trim() : "Anonymoid";

  const userId = typeof existingId === "string" && existingId.trim()
    ? normalizeUserId(existingId)
    : generateUserId();

  res.json({
    userId,
    nickname: safeNickname,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket) => {
    let registeredUserId: string | null = null;

    socket.on("message", (raw) => {
      let message: any;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        sendSocketMessage(socket, { type: "match:error", message: "Invalid message format." });
        return;
      }

      switch (message.type) {
        case "register": {
          const nextUserId = typeof message.userId === "string" && message.userId.trim()
            ? normalizeUserId(message.userId)
            : generateUserId();
          const nextNickname = typeof message.nickname === "string" && message.nickname.trim()
            ? message.nickname.trim()
            : "Anonymoid";

          if (registeredUserId && registeredUserId !== nextUserId) {
            onlineUsers.delete(registeredUserId);
          }

          registeredUserId = nextUserId;
          onlineUsers.set(nextUserId, {
            userId: nextUserId,
            nickname: nextNickname,
            socket,
          });

          sendSocketMessage(socket, {
            type: "registered",
            userId: nextUserId,
            nickname: nextNickname,
          });
          break;
        }

        case "match:request": {
          if (!registeredUserId) {
            sendSocketMessage(socket, { type: "match:error", message: "Register before sending a match request." });
            return;
          }

          const requester = getOnlineUser(registeredUserId);
          if (!requester) return;

          const targetId = typeof message.targetId === "string" ? normalizeUserId(message.targetId) : "";
          if (!targetId) {
            sendSocketMessage(socket, { type: "match:error", message: "Enter a valid player ID." });
            return;
          }

          if (targetId === registeredUserId) {
            sendSocketMessage(socket, { type: "match:error", message: "You cannot challenge yourself." });
            return;
          }

          const targetUser = getOnlineUser(targetId);
          if (!targetUser) {
            sendSocketMessage(socket, {
              type: "match:error",
              message: `Player "${targetId}" is offline. Make sure they have the page open and show "Online."`,
            });
            return;
          }

          if (requester.roomId || targetUser.roomId) {
            sendSocketMessage(socket, { type: "match:error", message: "One of the players is already in a match." });
            return;
          }

          const existingOutboundInviteId = outboundInvitesByUser.get(registeredUserId);
          if (existingOutboundInviteId) {
            pendingInvites.delete(existingOutboundInviteId);
          }

          const inviteId = generateInviteId();
          pendingInvites.set(inviteId, {
            inviteId,
            fromId: registeredUserId,
            toId: targetId,
            fromNickname: requester.nickname,
            createdAt: Date.now(),
          });
          outboundInvitesByUser.set(registeredUserId, inviteId);

          sendSocketMessage(requester.socket, {
            type: "match:sent",
            targetId,
            inviteId,
          });

          sendSocketMessage(targetUser.socket, {
            type: "match:incoming",
            inviteId,
            fromId: registeredUserId,
            fromNickname: requester.nickname,
          });
          break;
        }

        case "match:accept": {
          if (!registeredUserId) return;

          const inviteId = typeof message.inviteId === "string" ? message.inviteId : "";
          const invite = pendingInvites.get(inviteId);
          if (!invite || invite.toId !== registeredUserId) {
            sendSocketMessage(socket, { type: "match:error", message: "That invite is no longer valid." });
            return;
          }

          const requester = getOnlineUser(invite.fromId);
          const acceptor = getOnlineUser(invite.toId);
          if (!requester || !acceptor) {
            sendSocketMessage(socket, { type: "match:error", message: "The challenger went offline." });
            pendingInvites.delete(inviteId);
            return;
          }

          createPeerMatch(requester, acceptor, inviteId);
          break;
        }

        case "match:decline": {
          if (!registeredUserId) return;

          const inviteId = typeof message.inviteId === "string" ? message.inviteId : "";
          const invite = pendingInvites.get(inviteId);
          if (!invite || invite.toId !== registeredUserId) {
            return;
          }

          const requester = getOnlineUser(invite.fromId);
          pendingInvites.delete(inviteId);
          outboundInvitesByUser.delete(invite.fromId);

          if (requester) {
            sendSocketMessage(requester.socket, {
              type: "match:declined",
              by: "peer",
              fromId: registeredUserId,
            });
          }

          sendSocketMessage(socket, {
            type: "match:declined",
            by: "self",
          });
          break;
        }

        case "match:cancel": {
          if (!registeredUserId) return;

          const outboundInviteId = outboundInvitesByUser.get(registeredUserId);
          if (!outboundInviteId) return;

          const invite = pendingInvites.get(outboundInviteId);
          pendingInvites.delete(outboundInviteId);
          outboundInvitesByUser.delete(registeredUserId);

          if (invite) {
            const targetUser = getOnlineUser(invite.toId);
            if (targetUser) {
              sendSocketMessage(targetUser.socket, {
                type: "match:declined",
                by: "peer",
                fromId: registeredUserId,
                reason: "cancelled",
              });
            }
          }
          break;
        }

        case "match:leave": {
          if (!registeredUserId) return;

          const leavingUser = getOnlineUser(registeredUserId);
          if (!leavingUser) return;

          if (leavingUser.peerId) {
            const peer = getOnlineUser(leavingUser.peerId);
            if (peer) {
              clearUserMatchState(peer.userId);
              sendSocketMessage(peer.socket, {
                type: "match:declined",
                by: "peer",
                fromId: registeredUserId,
                reason: "disconnected",
              });
            }
          }

          clearUserMatchState(registeredUserId);
          break;
        }

        case "landmarks:send": {
          if (!registeredUserId) return;

          const sender = getOnlineUser(registeredUserId);
          if (!sender?.peerId) return;

          const peer = getOnlineUser(sender.peerId);
          if (!peer) return;

          const landmarks = message.landmarks;
          if (!Array.isArray(landmarks) || landmarks.length === 0) {
            return;
          }

          const isOrientationPacket = landmarks.length === 12;
          const isFullMesh = landmarks.length % 3 === 0 && landmarks.length <= 468 * 3;
          if (!isOrientationPacket && !isFullMesh) {
            return;
          }

          sendSocketMessage(peer.socket, {
            type: "landmarks:peer",
            landmarks,
            fromId: sender.userId,
          });
          break;
        }

        case "game:attack": {
          if (!registeredUserId) return;

          const game = getGameForUser(registeredUserId);
          // Only the current attacker, only during the attacker's turn.
          if (!game || game.phase !== "attackerTurn") return;
          if (registeredUserId !== game.attackerId) return;

          const direction = message.direction;
          if (direction !== "left" && direction !== "right") return;

          game.attackerDirection = direction;
          game.phase = "defenderTurn";

          // Note: we deliberately do NOT send attackerDirection to the defender
          // here — that would let them cheat. They must pick blind.
          broadcastGame(game, { type: "game:defenderTurn" });
          break;
        }

        case "game:defend": {
          if (!registeredUserId) return;

          const game = getGameForUser(registeredUserId);
          if (!game || game.phase !== "defenderTurn") return;
          if (registeredUserId !== game.defenderId) return;

          const defenderDirection = message.direction;
          if (defenderDirection !== "left" && defenderDirection !== "right") return;

          const attackerDirection = game.attackerDirection;
          const scoringAttackerId = game.attackerId;
          const attackerScored = attackerDirection === defenderDirection;

          let outcome: "attackerScored" | "defenderEvaded";
          if (attackerScored) {
            game.scores[scoringAttackerId] = (game.scores[scoringAttackerId] ?? 0) + 1;
            outcome = "attackerScored";
          } else {
            // Failed attack → swap roles.
            outcome = "defenderEvaded";
            const previousAttacker = game.attackerId;
            game.attackerId = game.defenderId;
            game.defenderId = previousAttacker;
          }

          const winnerId =
            (game.scores[scoringAttackerId] ?? 0) >= WIN_SCORE ? scoringAttackerId : null;

          game.phase = winnerId ? "gameOver" : "attackerTurn";
          game.attackerDirection = null;

          broadcastGame(game, {
            type: "game:result",
            outcome,
            attackerDirection,
            defenderDirection,
            winnerId,
          });

          if (winnerId) {
            games.delete(game.roomId);
          }
          break;
        }

        case "game:nod": {
          // Pure relay so the defender can see the attacker "winding up".
          if (!registeredUserId) return;

          const sender = getOnlineUser(registeredUserId);
          if (!sender?.peerId) return;

          const peer = getOnlineUser(sender.peerId);
          if (!peer) return;

          sendSocketMessage(peer.socket, {
            type: "game:nod",
            count: message.count,
            fromId: sender.userId,
          });
          break;
        }

        default:
          break;
      }
    });

    socket.on("close", () => {
      if (!registeredUserId) return;

      const closingUser = getOnlineUser(registeredUserId);
      if (closingUser?.peerId) {
        const peer = getOnlineUser(closingUser.peerId);
        if (peer) {
          clearUserMatchState(peer.userId);
          sendSocketMessage(peer.socket, {
            type: "match:declined",
            by: "peer",
            fromId: registeredUserId,
            reason: "disconnected",
          });
        }
      }

      clearUserMatchState(registeredUserId);
      onlineUsers.delete(registeredUserId);
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
