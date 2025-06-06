export function markGameStateAsChanged(roomId) {
  const gameState = getGameStateMatch(roomId);

  gameState.lastActionTimestamp = Date.now();
  gameState.stateVersion = (gameState.stateVersion || 0) + 1;
}

export function updateHeroPosition(heroId, newPosition) {
  const gameState = getGameStateMatch(roomId);

  for (const player of gameState.players) {
    const hero = player.heroes.find(h => h.id === heroId);
    if (!hero) continue;

    console.log(`Atualizando posição do herói ${hero.name} para ${newPosition}`);
    hero.state.position = newPosition;

    markGameStateAsChanged();
    return;
  }

  console.warn(`Herói com ID ${heroId} não encontrado para update de posição.`);
}

export function updateHeroStats(heroId, { currentHealth, isAlive, currentAttack, statusEffects, firstAttack }) {
  const gameState = getGameStateMatch(roomId);

  for (const player of this.gameState.players) {
    const hero = player.heroes.find(h => h.id === heroId);
    if (!hero) continue;

    if (currentHealth !== undefined) hero.stats.currentHealth = currentHealth;
    if (isAlive !== undefined) hero.state.isAlive = isAlive;
    if (currentAttack !== undefined) hero.stats.attack = currentAttack;
    if (statusEffects !== undefined) hero.state.statusEffects = statusEffects;
    if (firstAttack !== undefined) hero.firstAttack = firstAttack;

    this.markGameStateAsChanged();
    return;
  }

  console.warn(`Herói com ID ${heroId} não encontrado para update de stats.`);
}