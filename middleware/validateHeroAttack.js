function findHeroInMatch(match, heroId) {
  const players = match.gameState?.players || [];
  for (const player of players) {
    for (const hero of player.heroes || []) {
      if (hero.id == heroId) {
        return hero;
      }
    }
  }
  return null;
}

function getCurrentPlayerId(match) {
  return match.gameState?.currentTurn?.playerId;
}

function isHeroAlive(hero) {
  return hero && hero.state?.isAlive;
}

function doesHeroBelongToPlayer(hero, player) {
  return player.heroes?.some(h => h.id === hero.id);
}

export function validateHeroAttack({ match, socket, attackerId, targetId }) {
  if (!match || !attackerId || !targetId) {
    return { valid: false, reason: 'Dados inválidos ou incompletos.' };
  }

  const attacker = findHeroInMatch(match, attackerId);
  const target = findHeroInMatch(match, targetId);

  if (!attacker || !target || attacker.id === target.id) {
    return { valid: false, reason: 'Heróis inválidos ou idênticos.' };
  }

  const currentPlayerId = getCurrentPlayerId(match);
  const currentPlayer = match.gameState.players.find(p => p.id === currentPlayerId);
  const socketPlayerId = socket.playerId;

  if (!currentPlayer) {
    return { valid: false, reason: 'Jogador atual não encontrado.' };
  }

  if (socketPlayerId !== currentPlayerId) {
    return { valid: false, reason: 'Não é o turno do jogador.' };
  }

  if (!doesHeroBelongToPlayer(attacker, currentPlayer)) {
    return { valid: false, reason: 'O herói atacante não pertence ao jogador.' };
  }

  if (doesHeroBelongToPlayer(target, currentPlayer)) {
    return { valid: false, reason: 'O herói alvo pertence ao mesmo jogador.' };
  }

  if (!isHeroAlive(attacker)) {
    return { valid: false, reason: 'O herói atacante está morto.' };
  }

  if (!isHeroAlive(target)) {
    return { valid: false, reason: 'O herói alvo já está morto.' };
  }

  return { valid: true, attacker, target };
}
