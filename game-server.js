import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/routes.js';
import {
  configureUtils,
  getMatch,
  startTurnTimer,
  clearTurnTimer,
  startHeroSelectionTimer,
  clearHeroSelectionTimer,
  enrichPlayer,
  enqueue
} from './utils.js';
import { SOCKET_EVENTS } from './events.js';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { HERO_DATA } from './models/heroes.js';
dotenv.config();

const matches = new Map();
const waitingQueue = new Map();
const goodLuckCache = new Map();
const disconnectedPlayers = new Map();
const playerIdToSocketId = new Map();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_forte';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'https://kaiquenocetti.com', methods: ['GET', 'POST'] },
  perMessageDeflate: { threshold: 1024 }
});

configureUtils({ socketServer: io, matchStore: matches, events: SOCKET_EVENTS });

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Token não fornecido'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    return next(new Error('Token inválido'));
  }
});

const GAME_EVENTS = [
  SOCKET_EVENTS.HERO_SELECTED_REQUEST,
  SOCKET_EVENTS.SELECTION_COMPLETE,
  SOCKET_EVENTS.NEXT_TURN_REQUEST,
  SOCKET_EVENTS.HERO_MOVE_REQUEST,
  SOCKET_EVENTS.HERO_ATTACK_REQUEST,
  SOCKET_EVENTS.HERO_COUNTER_ATTACK_REQUEST,
  SOCKET_EVENTS.UPDATE_GAME_STATE,
  SOCKET_EVENTS.GAME_FINISHED_REQUEST,
  SOCKET_EVENTS.RECONNECTING_PLAYER
];

function removeGameListeners(socket, listeners) {
  GAME_EVENTS.forEach(event => {
    if (listeners[event]) {
      socket.off(event, listeners[event]);
    }
  });
}

function createGameListeners(socket, io, removeSelf) {
  return {
    [SOCKET_EVENTS.HERO_SELECTED_REQUEST]: ({ roomId, heroName, player, step }) => {
      enqueue(roomId, async () => {
        const match = matches.get(roomId);
        if (!match || match.gameState.status !== 'selecting_heroes') return;
        if (match.selectedHeroes.includes(heroName)) return;
        match.selectedHeroes.push(heroName);
        io.to(roomId).emit(SOCKET_EVENTS.HERO_SELECTED, { heroName, player, step });
        const nextPlayer = player === 1 ? 2 : 1;
        clearHeroSelectionTimer(roomId);
        startHeroSelectionTimer(roomId, nextPlayer, step);
      });
    },

    [SOCKET_EVENTS.SELECTION_COMPLETE]: ({ roomId, selectedHeroes }) => {
      const match = getMatch(roomId);
      if (!match) return;
      match.player1.heroes = selectedHeroes[match.player1.id];
      match.player2.heroes = selectedHeroes[match.player2.id];
      const startedPlayerId = Math.random() < 0.5 ? match.player1.id : match.player2.id;
      clearHeroSelectionTimer(roomId);
      startTurnTimer(roomId, startedPlayerId);
      const enrichedPlayer1 = enrichPlayer(match.player1, ['B1', 'C1', 'D1'], HERO_DATA);
      const enrichedPlayer2 = enrichPlayer(match.player2, ['B7', 'C6', 'D7'], HERO_DATA);
      const currentTurn = { attackedHeroes: [], counterAttack: false, movedHeroes: [], playerId: startedPlayerId, numberTurn: 1 };
      match.gameState = { roomId, players: [enrichedPlayer1, enrichedPlayer2], currentTurn, startedPlayerId, lastActionTimestamp: Date.now(), status: 'in_progress' };
      io.to(roomId).emit(SOCKET_EVENTS.START_GAME, match.gameState);
    },

    [SOCKET_EVENTS.NEXT_TURN_REQUEST]: ({ roomId, playerId }) => {
      const match = getMatch(roomId);
      if (!match || playerId !== match.gameState.currentTurn.playerId) return;
      match.gameState.currentTurn.playerId = (playerId === match.player1.id) ? match.player2.id : match.player1.id;
      goodLuckCache.delete(roomId);
      io.to(roomId).emit(SOCKET_EVENTS.NEXT_TURN, { nextPlayerId: match.gameState.currentTurn.playerId });
      clearTurnTimer(roomId);
      startTurnTimer(roomId, match.gameState.currentTurn.playerId);
    },

    [SOCKET_EVENTS.HERO_MOVE_REQUEST]: ({ roomId, heroId, targetLabel }) => {
      enqueue(roomId, async () => {
        const match = getMatch(roomId);
        if (!match) return;
        io.to(roomId).emit(SOCKET_EVENTS.HERO_MOVED, { heroId, targetLabel });
      });
    },

    [SOCKET_EVENTS.HERO_ATTACK_REQUEST]: ({ roomId, heroAttackerId, heroTargetId }) => {
      enqueue(roomId, async () => {
        const match = getMatch(roomId);
        if (!match) return;
        io.to(roomId).emit(SOCKET_EVENTS.HERO_ATTACKED, { heroAttackerId, heroTargetId });
      });
    },

    [SOCKET_EVENTS.HERO_COUNTER_ATTACK_REQUEST]: ({ roomId, heroAttackerId, heroTargetId }) => {
      const match = getMatch(roomId);
      if (!match) return;
      socket.broadcast.to(roomId).emit(SOCKET_EVENTS.HERO_COUNTER_ATTACK, { heroAttackerId, heroTargetId });
    },

    [SOCKET_EVENTS.UPDATE_GAME_STATE]: ({ roomId, gameState }) => {
      const match = getMatch(roomId);
      if (!match) return;
      match.gameState = gameState;
    },

    [SOCKET_EVENTS.RECONNECTING_PLAYER]: ({ playerId }) => {
      const data = disconnectedPlayers.get(playerId);
      if (!data) return socket.emit('RECONNECT_FAILED');
      const { roomId, timeout } = data;
      const match = matches.get(roomId);
      if (!match) return socket.emit('RECONNECT_FAILED');
      const opponentId = match.player1.id === playerId ? match.player2.id : match.player1.id;
      if (disconnectedPlayers.has(opponentId)) return socket.emit('RECONNECT_FAILED');
      playerIdToSocketId.set(playerId, socket.id);
      socket.playerId = playerId;
      socket.join(roomId);
      clearTimeout(timeout);
      disconnectedPlayers.delete(playerId);
      if (match.gameState) socket.emit(SOCKET_EVENTS.SYNC_GAME_STATE, { gameState: match.gameState });
      io.to(roomId).emit(SOCKET_EVENTS.RECONNECTING_PLAYER_SUCCESS);
    },

    [SOCKET_EVENTS.GAME_FINISHED_REQUEST]: ({ roomId, winner }) => {
      io.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, { winner });
      io.socketsLeave(roomId);
      matches.delete(roomId);
      goodLuckCache.delete(roomId);
      clearTurnTimer(roomId);
      removeSelf();
    }
  };
}

io.on('connection', (socket) => {
  const gameListeners = createGameListeners(socket, io, () => removeGameListeners(socket, gameListeners));

  Object.entries(gameListeners).forEach(([event, handler]) => socket.on(event, handler));

  socket.on(SOCKET_EVENTS.FINDING_MATCH, ({ player }) => {
    if (!player) return;
    setTimeout(() => {
      if (waitingQueue.has(player.id)) {
        waitingQueue.delete(player.id);
        socket.emit(SOCKET_EVENTS.QUIT_QUEUE);
      }
    }, 30000);
    socket.playerId = player.id;
    playerIdToSocketId.set(player.id, socket.id);
    const safeName = (player.name || '').trim().substring(0, 20) || `Jogador_${Math.floor(Math.random() * 1000)}`;
    if (waitingQueue.has(player.id)) return;
    waitingQueue.set(player.id, { id: player.id, name: safeName, heroes: [] });
    if (waitingQueue.size >= 2) {
      const iterator = waitingQueue.entries();
      const [playerId1, p1] = iterator.next().value;
      waitingQueue.delete(playerId1);
      const [playerId2, p2] = iterator.next().value;
      waitingQueue.delete(playerId2);
      const sock1 = io.sockets.sockets.get(playerIdToSocketId.get(playerId1));
      const sock2 = io.sockets.sockets.get(playerIdToSocketId.get(playerId2));
      if (!sock1 || !sock2) return;
      const roomId = `room_${playerId1}_${playerId2}`;
      sock1.join(roomId);
      sock2.join(roomId);
      const match = { player1: { ...p1, id: playerId1 }, player2: { ...p2, id: playerId2 }, selectedHeroes: [], gameState: { status: 'selecting_heroes' } };
      matches.set(roomId, match);
      io.to(roomId).emit(SOCKET_EVENTS.MATCH_FOUND, { players: [match.player1, match.player2], roomId });
      startHeroSelectionTimer(roomId, match.player1, 0);
    }
  });

  socket.on(SOCKET_EVENTS.QUIT_QUEUE, () => {
    if (socket.playerId) waitingQueue.delete(socket.playerId);
  });

  socket.on('disconnect', () => {
    removeGameListeners(socket, gameListeners);
    if (!socket.playerId) return;
    const playerId = socket.playerId;
    waitingQueue.delete(playerId);
    playerIdToSocketId.delete(playerId);
    
    for (const [roomId, match] of matches.entries()) {
      if (!match) continue;
      const isPlayer = match.player1.id === playerId || match.player2.id === playerId;
      if (!isPlayer) continue;

      if (match.gameState.status === 'selecting_heroes') {
        io.to(roomId).emit(SOCKET_EVENTS.RETURN_TO_MATCH_ONLINE);
        io.socketsLeave(roomId);
        matches.delete(roomId);
        return;
      }

      if (match.gameState.status === 'in_progress') {
        io.to(roomId).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED);
        const opponentId = match.player1.id === playerId ? match.player2.id : match.player1.id;
        const opponentDisconnected = disconnectedPlayers.has(opponentId);

        if (opponentDisconnected) {
          const winner = match.gameState.players.find(p => p.id !== playerId);
          io.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, { winner });
          io.socketsLeave(roomId);
          matches.delete(roomId);
          clearTurnTimer(roomId);
          disconnectedPlayers.delete(playerId);
          disconnectedPlayers.delete(opponentId);
          return;
        }

        const timeout = setTimeout(() => {
          const winner = match.gameState.players.find(p => p.id !== playerId);
          io.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, { winner });
          io.socketsLeave(roomId);
          matches.delete(roomId);
          clearTurnTimer(roomId);
          disconnectedPlayers.delete(playerId);
        }, 20000);

        disconnectedPlayers.set(playerId, { socketId: socket.id, roomId, timeout });
      }
    }
  });
});

const allowedOrigins = ['https://kaiquenocetti.com'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use('/api', [routes]);

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
