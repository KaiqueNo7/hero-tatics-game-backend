import { chooseHero } from './controllers/botController.js';

let matches;
let io;
let SOCKET_EVENTS;

const TURN_DURATION = 90;
const turnIntervals = new Map();

const SELECTION_STEP_DURATION = 20;
const heroSelectionIntervals = new Map();
const queues = new Map();

export function configureUtils({ socketServer, matchStore, events }) {
  io = socketServer;
  matches = matchStore;
  SOCKET_EVENTS = events;
}

export function getMatch(roomId) {
  return matches.get(roomId);
}

export function getGameStateMatch(roomId) {
  const match = matches.get(roomId);
  const gameState = match.gameState;

  if(!gameState){
    console.log('Jogo sem estado!');
  }

  return gameState;
}

export function startTurnTimer(roomId, playerId) {
  clearTurnTimer(roomId);

  let timeLeft = TURN_DURATION;

  const interval = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit(SOCKET_EVENTS.TURN_TIMER_TICK, { timeLeft });

    if (timeLeft <= 0) {
      clearInterval(interval);
      turnIntervals.delete(roomId);
      io.to(roomId).emit(SOCKET_EVENTS.TURN_TIMEOUT, { playerId });
    }
  }, 1000);

  turnIntervals.set(roomId, interval);
}

export function clearTurnTimer(roomId) {
  const interval = turnIntervals.get(roomId);
  if (interval) {
    clearInterval(interval);
    turnIntervals.delete(roomId);
  }
}

export function startHeroSelectionTimer(roomId, currentPlayerId, currentStep) {
  clearHeroSelectionTimer(roomId);

  const match = matches.get(roomId);
  if (!match) return;

  const currentPlayer = match.gameState.players.find((p) => p.id === currentPlayerId);
  console.log(currentPlayer, currentStep);

  if (currentPlayer.isBot == true) {
    console.log(`[BOT] É a vez do bot escolher herói`);
    chooseHero(roomId, currentPlayerId, currentStep);
    return;
  }

  let timeLeft = SELECTION_STEP_DURATION;

  const interval = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit(SOCKET_EVENTS.HERO_SELECTION_TICK, { timeLeft });

    if (timeLeft <= 0) {
      clearHeroSelectionTimer(roomId);
      io.to(roomId).emit(SOCKET_EVENTS.HERO_SELECTION_TIMEOUT, {
        playerId: currentPlayerId,
        step: currentStep,
        roomId
      });
    }
  }, 1000);

  heroSelectionIntervals.set(roomId, interval);
}

export function clearHeroSelectionTimer(roomId) {
  const timer = heroSelectionIntervals.get(roomId);
  if (timer) {
    clearInterval(timer);
    heroSelectionIntervals.delete(roomId);
  }
}

export function enqueue(roomId, task) {
  if (!queues.has(roomId)) {
    queues.set(roomId, []);
  }

  const queue = queues.get(roomId);
  queue.push(task);

  if (queue.length === 1) {
    processQueue(roomId);
  }
}

export async function processQueue(roomId) {
  const queue = queues.get(roomId);
  while (queue.length > 0) {
    const task = queue[0];
    try {
      await task();
    } catch (err) {
      console.error(`Erro ao processar evento da sala ${roomId}`, err);
    }
    queue.shift();
  }
}

export function resolveHeroes(heroNames, heroData) {
  return heroNames.map((name) => heroData.find((h) => h.name === name));
}

export function enrichHero(hero) {
  return {
    id: hero.id,
    name: hero.name,
    frame: hero.frame,
    firstAttack: hero.firstAttack,
    stats: {
      attack: hero.stats.attack,
      currentHealth: hero.stats.hp,
    },
    state: {
      position: null,
      isAlive: true,
      statusEffects: [],
    },
  };
}

export function enrichPlayer(player, positions, heroData) {
  const heroes = resolveHeroes(player.heroes, heroData).map(enrichHero);
  setupHeroPositions(heroes, positions);
  return {
    ...player,
    heroes
  };
}

export function setupHeroPositions(heroes, positions) {
  heroes.forEach((hero, index) => {
    if (positions[index]) {
      hero.state.position = positions[index];
    }
  });
}
