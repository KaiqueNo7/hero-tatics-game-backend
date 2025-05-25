export const HERO_DATA = [
  {
    id: 1,
    name: 'Ralph',
    frame: 2,
    stats: { attack: 3, hp: 17, ability: null },
    abilities: [
      { key: 'firstPunch', name: 'First Punch', description: 'Descrição do soco' },
      { key: 'autoDefense', name: 'Auto Defense', description: 'Descrição da defesa' }
    ]
  },
  {
    id: 2,
    name: 'Vic',
    frame: 1,
    stats: { attack: 1, hp: 19, ability: null },
    abilities: [
      { key: 'poisonAttack', name: 'Poison Attack', description: 'Envenena o alvo' }
    ]
  },
  {
    id: 3,
    name: 'Mineiro',
    frame: 0,
    stats: { attack: 1, hp: 18, ability: 'Sprint' },
    abilities: [
      { key: 'goodLuck', name: 'Good Luck', description: 'Aumenta chance de crítico' }
    ]
  },
  {
    id: 4,
    name: 'Blade',
    frame: 4,
    stats: { attack: 3, hp: 16, ability: null },
    abilities: [
      { key: 'beyondFront', name: 'Beyond Front', description: 'Avança além do inimigo' }
    ]
  },
  {
    id: 5,
    name: 'Dante',
    frame: 5,
    stats: { attack: 2, hp: 18, ability: 'Ranged' },
    abilities: [
      { key: 'brokenDefense', name: 'Broken Defense', description: 'Ignora armadura' },
      { key: 'trustInTeam', name: 'Trust in Team', description: 'Buffa aliados' }
    ]
  },
  {
    id: 6,
    name: 'Ceos',
    frame: 3,
    stats: { attack: 1, hp: 33, ability: 'Taunt' },
    abilities: [
      { key: 'absorbRoots', name: 'Absorb Roots', description: 'Puxa vida do chão' }
    ]
  }
];
