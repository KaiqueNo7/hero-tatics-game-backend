export default class Player {
  constructor(name, heros = [], id, number) {
    this.id = id;
    this.name = name;
    this.heros = heros;
    this.number = number;
  }

  setNumber(number){
    this.number = number;
  }

  addHeroes(heroes){
    heroes.forEach(hero => {
      hero.addPlayerId(this.id);
      this.heros.push(hero);
    });
  }

  toJSON() {
    return {
      heros: this.heros.map(char => char.toJSON()),
      id: this.id,
      name: this.name,
      number: this.number
    };
  }
}
