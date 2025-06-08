import { matches } from '../game-server.js';
import { handleHeroSelection } from '../game-server.js';
import { HERO_DATA } from '../models/heroes.js';

function getAvailableHeroes(selectedNames) {
  return HERO_DATA.filter(h => !selectedNames.includes(h.name));
}

function pickRandomHero(availableHeroes) {
  if (availableHeroes.length === 0) return null;
  const index = Math.floor(Math.random() * availableHeroes.length);
  return availableHeroes[index];
}

export function chooseHero(roomId, botPlayerNumber, step) {
  const match = matches.get(roomId);
  if (!match) return;

  const selectedNames = match.selectedHeroes;
  const availableHeroes = getAvailableHeroes(selectedNames);
  const chosenHero = pickRandomHero(availableHeroes);

  if (!chosenHero) {
    console.warn(`[BOT] Nenhum herói disponível para selecionar na sala ${roomId}`);
    return;
  }

  console.log(`[BOT] ${chosenHero.name} foi escolhido na sala ${roomId}`);

  setTimeout(() => {
    handleHeroSelection({
      roomId,
      heroName: chosenHero.name,
      player: botPlayerNumber,
      step,
    });
  }, 1200);
}
