export const HERO_DATA = [
  {
    id: 1,
    name: 'Ralph',
    frame: 2,
    icon_attack: 'boxing_glove',
    stats: { attack: 3, hp: 18, ability: null },
    abilities: [
      { key: 'firstPunch', name: 'First Punch', description: 'first_punch_desc' },
      { key: 'autoDefense', name: 'Auto Defense', description: 'auto_defense_desc' }
    ]
  },
  {
    id: 2,
    name: 'Vic',
    frame: 1,
    icon_attack: 'poison',
    stats: { attack: 1, hp: 20, ability: null },
    abilities: [
      { key: 'poisonAttack', name: 'Poison Attack', description: 'poison_attack_desc' }
    ]
  },
  {
    id: 3,
    name: 'Mineiro',
    icon_attack: 'default',
    frame: 0,
    stats: { attack: 1, hp: 18, ability: 'Sprint' },
    abilities: [
      { key: 'goodLuck', name: 'Good Luck', description: 'good_luck_desc' }
    ]
  },
  {
    id: 4,
    name: 'Blade',
    icon_attack: 'sword_slash',
    frame: 4,
    stats: { attack: 3, hp: 16, ability: null },
    abilities: [
      { key: 'beyondFront', name: 'Beyond Front', description: 'beyond_front_desc' }
    ]
  },
  {
    id: 5,
    name: 'Dante',
    icon_attack: 'arrow',
    frame: 5,
    stats: { attack: 2, hp: 18, ability: 'Ranged' },
    abilities: [
      { key: 'brokenDefense', name: 'Broken Defense', description: 'broken_defense_desc' },
      { key: 'trustInTeam', name: 'Trust in Team', description: 'trust_in_team_desc' }
    ]
  },
  {
    id: 6,
    name: 'Ceos',
    icon_attack: 'default',
    frame: 3,
    stats: { attack: 1, hp: 33, ability: 'Taunt' },
    abilities: [
      { key: 'absorbRoots', name: 'Absorb Roots', description: 'absorb_roots_desc' }
    ]
  },
  {
    id: 7,
    name: 'Noctin',
    icon_attack: 'knife_slash',
    frame: 8,
    stats: { attack: 3, hp: 14, ability: 'Sprint' },
    abilities: [
      { key: 'aloneIsBetter', name: 'Alone is Better', description: 'alone_is_better_desc' }
    ]
  },
  {
    id: 8,
    name: 'Elaria',
    icon_attack: 'spell',
    frame: 7,
    stats: { attack: 1, hp: 19, ability: 'Ranged' },
    abilities: [
      { key: 'health', name: 'Health', description: 'health_desc' },
      { key: 'clean', name: 'Clean', description: 'clean_desc' }
    ]
  },
  {
    id: 9,
    name: 'Bramm',
    icon_attack: 'default',
    frame: 6,
    stats: { attack: 2, hp: 26, ability: 'Taunt' },
    abilities: [
      { key: 'rage', name: 'Rage', description: 'rage_desc' }
    ]
  }
];
