import express from 'express';
import { SOCKET_EVENTS } from './events.js';
import http from 'http';
import Player from './player.js';
import { Server } from 'socket.io';

const app = express();

app.get('/', (req, res) => {
  res.send('Servidor do Hero Tactics está no ar! 🎯');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    methods: ['GET', 'POST'],
    origin: ['https://kaiquenocetti.com', 'http://localhost:5173']
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

const waitingQueue = [];
const matches = {};
const goodLuckCache = new Map();

io.on('connection', (socket) => {
  socket.on(SOCKET_EVENTS.QUIT_QUEUE, () => {
    console.log(`Jogador ${socket.id} saiu da fila`);
    const index = waitingQueue.findIndex(s => s.id === socket.id);
    if (index !== -1) waitingQueue.splice(index, 1);
  });

  socket.on(SOCKET_EVENTS.FINDING_MATCH, ({ name }) => {
    console.log(`Jogador ${socket.id} entrou na fila`);
    socket.playerName = name ? name : `Jogador_${socket.id}`;

    waitingQueue.push(socket);

    if (waitingQueue.length >= 2) {
      const playerSocket1 = waitingQueue.shift();
      const playerSocket2 = waitingQueue.shift();

      const roomId = `room_${playerSocket1.id}_${playerSocket2.id}`;
      playerSocket1.join(roomId);
      playerSocket2.join(roomId);

      matches[roomId] = {
        player1: new Player('Player 1', [], playerSocket1.id, 1),
        player2: new Player('Player 2', [], playerSocket2.id, 2),
        selectedHeroes: []
      };

      console.log(`Criando partida na sala ${roomId}`);

      io.to(roomId).emit(SOCKET_EVENTS.MATCH_FOUND, {
        players: [
          matches[roomId].player1.toJSON(),
          matches[roomId].player2.toJSON()
        ],
        roomId
      });
    }
  });

  socket.on(SOCKET_EVENTS.HERO_SELECTED, ({ roomId, heroName, player, step }) => {
    console.log(`Jogador ${socket.id} selecionou o herói ${heroName} na sala ${roomId}`);
    socket.to(roomId).emit(SOCKET_EVENTS.HERO_SELECTED, { heroName, player, step });
  });

  socket.on(SOCKET_EVENTS.SELECTION_COMPLETE, ({ roomId, players, heroes }) => {
    console.log(`[SERVER] SELECTION_COMPLETE recebido. Enviando START_GAME para sala ${roomId}`);

    const startingIndex = Math.floor(Math.random() * 2);
    const startedPlayerIndex = startingIndex;

    io.to(roomId).emit(SOCKET_EVENTS.START_GAME, {
      heroes,
      players,
      roomId,
      startedPlayerIndex
    });
  });

  socket.on(SOCKET_EVENTS.NEXT_TURN_REQUEST, ({ roomId }) => {
    console.log(`[SERVER] NEXT_TURN recebido. Enviando NEXT_TURN para sala ${roomId}`);
    goodLuckCache.delete(roomId);
    io.to(roomId).emit(SOCKET_EVENTS.NEXT_TURN);
  })

  socket.on(SOCKET_EVENTS.HERO_MOVE_REQUEST, ({ roomId, heroPosition, targetLabel }) => {
    console.log(`[SERVER] HERO_MOVE_REQUEST recebido. Enviando HERO_MOVED para sala ${roomId}`);
    socket.broadcast.to(roomId).emit(SOCKET_EVENTS.HERO_MOVED, { heroPosition, targetLabel });
  });  

  socket.on(SOCKET_EVENTS.HERO_ATTACK_REQUEST, ({ roomId, attackerPosition, targetPosition }) => {
    console.log(`[SERVER] HERO_ATTACK_REQUEST de ${socket.id} - broadcast para sala ${roomId}`);
    socket.broadcast.to(roomId).emit(SOCKET_EVENTS.HERO_ATTACKED, {
      attackerPosition,
      targetPosition
    });
  });

  socket.on(SOCKET_EVENTS.GAME_FINISHED, ({ roomId, winnerId }) => {
    io.to(roomId).emit(SOCKET_EVENTS.GAME_FINISHED, { winnerId });
    delete matches[roomId];
  });

  socket.on('CHECK_GOOD_LUCK', ({ roomId }) => {
    if (goodLuckCache.has(roomId)) {
      const result = goodLuckCache.get(roomId);
      socket.emit('GOOD_LUCK_RESULT', result);
      return;
    }
  
    const gotLucky = Math.random() < 0.5;
    goodLuckCache.set(roomId, gotLucky);
  
    console.log('Resultado do GOOD_LUCK:', gotLucky);
    io.to(roomId).emit('GOOD_LUCK_RESULT', gotLucky);
  });

  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    const index = waitingQueue.findIndex(s => s.id === socket.id);
    if (index !== -1) waitingQueue.splice(index, 1);
  });
});
