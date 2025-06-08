export const HERO_DATA = [
  {
    id: 1,
    name: 'Ralph',
    frame: 2,
    icon_attack: 'boxing_glove',
    stats: { attack: 3, hp: 1, ability: null },
    abilities: [
      { key: 'firstPunch', name: 'First Punch', description: 'O primeiro ataque do herói na partida causa +2 de dano.' },
      { key: 'autoDefense', name: 'Auto Defense', description: 'Recebe 1 ponto a menos de dano ao sofrer contra-ataques.' }
    ]
  },
  {
    id: 2,
    name: 'Vic',
    frame: 1,
    icon_attack: 'poison',
    stats: { attack: 1, hp: 1, ability: null },
    abilities: [
      { key: 'poisonAttack', name: 'Poison Attack', description: 'Envenena o inimigo por 3 turnos causando 1 de dano por turno. Causa  +2 de dano contra inimigos já envenenados.' }
    ]
  },
  {
    id: 3,
    name: 'Mineiro',
    icon_attack: 'default',
    frame: 0,
    stats: { attack: 1, hp: 1, ability: 'Sprint' },
    abilities: [
      { key: 'goodLuck', name: 'Good Luck', description: 'Tem 50% de chance de ganhar +1 de ataque ao mudar o turno.' }
    ]
  },
  {
    id: 4,
    name: 'Blade',
    icon_attack: 'sword_slash',
    frame: 4,
    stats: { attack: 3, hp: 1, ability: null },
    abilities: [
      { key: 'beyondFront', name: 'Beyond Front', description: 'Ataca até 3 casas em linha reta na direção do ataque, se estiverem ocupadas por inimigos.' }
    ]
  },
  {
    id: 5,
    name: 'Dante',
    icon_attack: 'arrow',
    frame: 5,
    stats: { attack: 2, hp: 1, ability: 'Ranged' },
    abilities: [
      { key: 'brokenDefense', name: 'Broken Defense', description: 'Causa +2 de dano contra inimigos com o status "Taunt".' },
      { key: 'trustInTeam', name: 'Trust in Team', description: 'Recebe +1 de ataque ao ter aliados em casas adjacentes.' }
    ]
  },
  {
    id: 6,
    name: 'Ceos',
    icon_attack: 'default',
    frame: 3,
    stats: { attack: 1, hp: 1, ability: 'Taunt' },
    abilities: [
      { key: 'absorbRoots', name: 'Absorb Roots', description: 'Recupera vida equivalente ao dano causado.' }
    ]
  },
  {
    id: 7,
    name: 'Noctin',
    icon_attack: 'knife_slash',
    frame: 8,
    stats: { attack: 3, hp: 1, ability: 'Sprint' },
    abilities: [
      { key: 'aloneIsBetter', name: 'alone Is Better', description: 'Se atacar um inimigo isolado causa o dobro de dano.' }
    ]
  },
  {
    id: 8,
    name: 'Elaria',
    icon_attack: 'spell',
    frame: 7,
    stats: { attack: 1, hp: 1, ability: 'Ranged' },
    abilities: [
      { key: 'health', name: 'Health', description: 'Cura aliados próximos. (+2)' },
      { key: 'clean', name: 'Clean', description: 'Remove os efeitos negativos de aliados próximos.' }
    ]
  },
  {
    id: 9,
    name: 'Bramm',
    icon_attack: 'default',
    frame: 6,
    stats: { attack: 2, hp: 1, ability: 'Taunt' },
    abilities: [
      { key: 'rage', name: 'Rage', description: 'Move o inimigo uma casa para trás. Se bloqueado o movimento o inimigo recebe dano novamente.' }
    ]
  }
];