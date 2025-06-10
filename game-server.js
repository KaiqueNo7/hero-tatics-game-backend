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
import { db } from './models/db.js';

import { validateHeroAttack } from './middleware/validateHeroAttack.js';
dotenv.config();

export const matches = new Map();
const waitingQueue = new Map();
const goodLuckCache = new Map();
const disconnectedPlayers = new Map();
const playerIdToSocketId = new Map();
const matchDataProcessed = new Map();
const playerTimeouts = new Map();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'segredo_forte';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ['https://kaiquenocetti.com', 'http://localhost:5173'], methods: ['GET', 'POST'] },
  perMessageDeflate: false
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

async function handleGameFinishedRequest({ roomId, winnerId, playerIds }, io) {
  if (matchDataProcessed.has(roomId)) return;
  matchDataProcessed.set(roomId, { processed: true });

  const isBot = (id) => typeof id === 'string' && id.startsWith('BOT_');

  try {
    clearTurnTimer(roomId);

    if (!winnerId || !Array.isArray(playerIds) || playerIds.length !== 2) {
      console.error('Dados da partida inválidos recebidos via socket.');
      return;
    }

    const [player1Id, player2Id] = playerIds;

    const [player1Rows] = isBot(player1Id)
      ? [[]]
      : await db.query('SELECT xp, level, coins, wins, losses FROM players WHERE id = ?', [player1Id]);

    const [player2Rows] = isBot(player2Id)
      ? [[]]
      : await db.query('SELECT xp, level, coins, wins, losses FROM players WHERE id = ?', [player2Id]);

    if (!isBot(player1Id) && player1Rows.length === 0) {
      console.error('Jogador 1 não encontrado no banco de dados.');
      return;
    }

    if (!isBot(player2Id) && player2Rows.length === 0) {
      console.error('Jogador 2 não encontrado no banco de dados.');
      return;
    }

    const player1 = player1Rows[0];
    const player2 = player2Rows[0];

    const updatePlayerStats = async (playerId, isWinner, currentPlayer) => {
      const earnedXp = isWinner ? 100 : 50;
      const column = isWinner ? 'wins' : 'losses';
      let newXp = currentPlayer.xp + earnedXp;
      let newLevel = currentPlayer.level;
      let newCoins = currentPlayer.coins;
      const xpPerLevel = 500;

      while (newXp >= newLevel * xpPerLevel) {
        newXp -= newLevel * xpPerLevel;
        newLevel += 1;
        newCoins += 200;
      }

      await db.query(
        `UPDATE players
         SET ${column} = ${column} + 1,
             xp = ?,
             level = ?,
             coins = ?
         WHERE id = ?`,
        [newXp, newLevel, newCoins, playerId]
      );

      return { xp: newXp, level: newLevel, coins: newCoins };
    };

    if (!isBot(player1Id)) {
      await updatePlayerStats(player1Id, winnerId === player1Id, player1);
    }

    if (!isBot(player2Id)) {
      await updatePlayerStats(player2Id, winnerId === player2Id, player2);
    }

    io.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, { winnerId });

    io.socketsLeave(roomId);
    matches.delete(roomId);
    matchDataProcessed.delete(matchDataProcessed);
    goodLuckCache.delete(roomId);
  } catch (err) {
    console.error('Erro ao atualizar estatísticas da partida:', err);

    io.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, { winnerId });

    io.socketsLeave(roomId);
    matches.delete(roomId);
    matchDataProcessed.delete(matchDataProcessed);
    goodLuckCache.delete(roomId);
  }
}

function removeGameListeners(socket, listeners) {
  GAME_EVENTS.forEach(event => {
    if (listeners[event]) {
      socket.off(event, listeners[event]);
    }
  });
}

function generateBotPlayer() {
  const botNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'Zeta', 'Echo', 'Nova'];
  const name = `${botNames[Math.floor(Math.random() * botNames.length)]}`;
  return {
    id: 'BOT_' + Math.floor(Math.random() * 10000),
    name,
    isBot: true,
    heroes: [],
  };
}

function createBotMatch(player, sock) {
  const roomId = `room_${player.id}_bot_${Date.now()}`;
  sock.join(roomId);

  const bot = generateBotPlayer();
  const match = {
    player1: { ...player },
    player2: bot,
    selectedHeroes: [],
    gameState: { status: 'selecting_heroes', players: [player, bot] },
    isBotMatch: true,
    selectionOrder: [
      { count: 1, player: 1 },
      { count: 2, player: 2 },
      { count: 2, player: 1 },
      { count: 1, player: 2 } 
    ],
    currentStep: 0,
    currentStepCount: 0,
  };

  matches.set(roomId, match);

  sock.emit(SOCKET_EVENTS.MATCH_FOUND, {
    players: [match.player1, match.player2],
    roomId,
  });

  startHeroSelectionTimer(roomId, player.id, 0);
}

export function handleHeroSelection({ roomId, heroName, player }) {
  enqueue(roomId, async () => {
    const match = matches.get(roomId);

    if (!match || match.gameState.status !== 'selecting_heroes') return;
    if (match.selectedHeroes.includes(heroName)) return;

    match.selectedHeroes.push(heroName);

    io.to(roomId).emit(SOCKET_EVENTS.HERO_SELECTED, {
      heroName,
      player,
      step: match.currentStep
    });

    const current = match.selectionOrder[match.currentStep];
    match.currentStepCount++;

    if (match.currentStepCount >= current.count) {
      match.currentStep++;
      match.currentStepCount = 0;
    }

    const nextStep = match.selectionOrder[match.currentStep];

    if (!nextStep) {
      clearHeroSelectionTimer(roomId);
      return;
    }

    const nextPlayer = nextStep.player;

    io.to(roomId).emit(SOCKET_EVENTS.STEP_UPDATED, {
      currentStep: match.currentStep,
      currentPlayer: nextPlayer
    });

    const playerSocketId = nextPlayer === 1 ? match.player1.id : match.player2.id;
    clearHeroSelectionTimer(roomId);
    startHeroSelectionTimer(roomId, playerSocketId, match.currentStep);
  });
}

function createGameListeners(socket, io, ) {
  return {
    [SOCKET_EVENTS.HERO_SELECTED_REQUEST]: ({ roomId, heroName, player, step }) => {
      enqueue(roomId, async () => {
        handleHeroSelection({roomId, heroName, player, step});
      });
    },

    [SOCKET_EVENTS.SELECTION_COMPLETE]: ({ roomId, selectedHeroes }) => {
      const match = getMatch(roomId);
      if (!match) return;
      
      match.player1.heroes = selectedHeroes[match.player1.id];
      match.player2.heroes = selectedHeroes[match.player2.id];

      const startedPlayerId = match.gameState.startedPlayerId 
      ? match.gameState.startedPlayerId 
      : (Math.random() < 0.5 ? match.player1.id : match.player2.id);
    
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

        const result = validateHeroAttack({
          match,
          socket,
          attackerId: heroAttackerId,
          targetId: heroTargetId,
        });

        if (!result.valid) {
          console.log(`Ataque inválido: ${result.reason}`);
          return;
        }
        
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
      if (!match){
        disconnectedPlayers.delete(playerId);
        return socket.emit('RECONNECT_FAILED');
      } 
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

    [SOCKET_EVENTS.GAME_FINISHED_REQUEST]: async (data) => {
      const { roomId, winnerId } = data;
      const match = getMatch(roomId);
      if (!match) return;

      match.gameState.status = 'finished';
      match.gameState.winnerId = winnerId

      await handleGameFinishedRequest(data, io);
    },

    ['CHECK_GOOD_LUCK']: ({ roomId }) => {
      if (goodLuckCache.has(roomId)) {
        socket.emit('GOOD_LUCK_RESULT', goodLuckCache.get(roomId));
      } else {
        const result = Math.random() < 0.5;
        goodLuckCache.set(roomId, result);    
        io.to(roomId).emit('GOOD_LUCK_RESULT', result);
      }
    }
  };
}

io.on('connection', (socket) => {
  const gameListeners = createGameListeners(socket, io);

  socket.on('ping_check', (callback) => {
    callback();
  });

  Object.entries(gameListeners).forEach(([event, handler]) => socket.on(event, handler));

  socket.on(SOCKET_EVENTS.FINDING_MATCH, ({ player }) => {
    if (!player) return;

    const timeout = setTimeout(() => {
      if (waitingQueue.has(player.id)) {
        console.log(`[MATCHMAKING] Jogador ${player.id} esperou muito. Criando partida com bot.`);
        const p1 = waitingQueue.get(player.id);
        waitingQueue.delete(player.id);
        playerTimeouts.delete(player.id);
        createBotMatch(p1, socket);
      }
    }, 20000);

    playerTimeouts.set(player.id, timeout);

    socket.playerId = player.id;
    playerIdToSocketId.set(player.id, socket.id);

    const safeName = (player.name || '').trim().substring(0, 20) || `Jogador_${Math.floor(Math.random() * 1000)}`;

    if (waitingQueue.has(player.id)) return;
    waitingQueue.set(player.id, { id: player.id, name: safeName, heroes: [] });
    if (waitingQueue.size >= 2) {
      const iterator = waitingQueue.entries();

      const [playerId1, p1] = iterator.next().value;
      waitingQueue.delete(playerId1);

      clearTimeout(playerTimeouts.get(playerId1));
      playerTimeouts.delete(playerId1);

      const [playerId2, p2] = iterator.next().value;
      waitingQueue.delete(playerId2);

      clearTimeout(playerTimeouts.get(playerId2));
      playerTimeouts.delete(playerId2);

      const sock1 = io.sockets.sockets.get(playerIdToSocketId.get(playerId1));
      const sock2 = io.sockets.sockets.get(playerIdToSocketId.get(playerId2));

      if (!sock1 || !sock2) return;
      const roomId = `room_${playerId1}_${playerId2}_${Date.now()}`;

      sock1.join(roomId);
      sock2.join(roomId);

      const player1 = { ...p1, id: playerId1, isBot: false };
      const player2 = { ...p2, id: playerId2, isBot: false };

      const match = { 
        player1: player1, 
        player2: player2, 
        selectedHeroes: [], 
        gameState: { 
          status: 'selecting_heroes',
          players: [player1, player2] 
        },
        isBotMatch: false,
        selectionOrder: [
          { count: 1, player: 1 },
          { count: 2, player: 2 },
          { count: 2, player: 1 },
          { count: 1, player: 2 } 
        ],
        currentStep: 0,
        currentStepCount: 0,
      };
      matches.set(roomId, match);

      io.to(roomId).emit(SOCKET_EVENTS.MATCH_FOUND, { players: [match.player1, match.player2], roomId });
      startHeroSelectionTimer(roomId, match.player1.id, 0);
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
    clearTimeout(playerTimeouts.get(playerId));
    playerTimeouts.delete(playerId);
    playerIdToSocketId.delete(playerId);
    
    for (const [roomId, match] of matches.entries()) {
      if (!match) continue;
      const isPlayer = match.player1.id === playerId || match.player2.id === playerId;
      if (!isPlayer) continue;

      if (match.gameState.status === 'selecting_heroes') {
        io.to(roomId).emit(SOCKET_EVENTS.RETURN_TO_MATCH_ONLINE);
        io.socketsLeave(roomId);
        matches.delete(roomId);
        clearHeroSelectionTimer(roomId);
        disconnectedPlayers.delete(playerId);
        return;
      }

      if (match.gameState.status === 'in_progress') {
        io.to(roomId).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED);

        const timeout = setTimeout(async () => {
          const winner = match.gameState.players.find(p => p.id !== playerId);
          const winnerId = winner.id;
          const playerIds = match.gameState.players.map(player => player.id);

          await handleGameFinishedRequest({ roomId, winnerId, playerIds }, io);
          io.socketsLeave(roomId);
          matches.delete(roomId);
          clearTurnTimer(roomId);
          disconnectedPlayers.delete(playerId);
          socket.removeAllListeners();
        }, 20000);

        disconnectedPlayers.set(playerId, { socketId: socket.id, roomId, timeout });
      }
    }
  });
});

const allowedOrigins = ['https://kaiquenocetti.com', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json());
app.use('/api', [routes]);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Service is up and running' });
});

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
