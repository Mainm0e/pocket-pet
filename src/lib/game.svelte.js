import { api } from './api.js';
import { MARKS } from '../server/constants.js';
import { sfx } from './sound.js';

let seq = 0;

class Game {
  s = $state(null); // latest server state (read-only view)
  bubble = $state(null); // { text, id }
  fx = $state(null); // { name, id }
  evolution = $state(null); // { from, to }
  naming = $state(false);
  toast = $state(null);
  sheet = $state(null); // 'stats' | 'card' | 'more'
  battleOpen = $state(false);
  decorating = $state(false);
  greet = $state(null); // { fx, line }: played by the room once the pet is on screen

  get pet() {
    return this.s?.pet ?? null;
  }

  async load() {
    this.apply(await api.getState());
  }

  apply(res) {
    if (!res) return;
    if (res.state) this.s = res.state;
    for (const e of res.events ?? []) this.handle(e);
    if (res.error) this.showToast(res.error);
  }

  handle(e) {
    switch (e.type) {
      case 'evolved':
        this.sheet = null;
        this.evolution = { from: e.from, to: e.to };
        break;
      case 'mark':
        this.showToast(`New memory mark: ${MARKS[e.mark].label}!`);
        sfx('chime');
        break;
      case 'woke':
        this.say('Good morning!');
        sfx('wake');
        break;
      case 'crack':
        this.play('wobble');
        sfx('crack');
        break;
      case 'rareSpecies':
        this.showToast(`Something glows... a 1 in ${Math.round(1 / e.odds).toLocaleString('en')} egg!`);
        break;
      case 'greet': {
        const b = e.bond;
        const [fx, lines] =
          b >= 75 ? ['greetBest', ["You're back!!", 'I missed you SO much!', 'Yay! Yay! You came back!']]
          : b >= 50 ? ['greetGood', ['Hi! I missed you!', 'Welcome back!', 'There you are!']]
          : b >= 25 ? ['greetOk', ['Oh! Hi there.', 'You came back!', 'Hello again!']]
          : ['greetShy', ['...hi.', '*peeks*', "Oh... it's you."]];
        this.greet = { fx, line: lines[Math.floor(Math.random() * lines.length)] };
        break;
      }
      case 'wish':
        this.play('wish', 2500);
        this.showToast(`Wish granted! ♥ Bond +${e.bond}`);
        setTimeout(() => this.say(['Thank you!!', 'You remembered!', 'Best day ever!'][Math.floor(Math.random() * 3)], 2400), 300);
        break;
      case 'hatched':
        this.play('hatch');
        sfx('hatch');
        if (this.pet?.genome.speciesOdds < 0.001)
          setTimeout(() => this.showToast(`A ${this.pet.genome.speciesLabel}! Only 1 in ${Math.round(1 / this.pet.genome.speciesOdds).toLocaleString('en')} eggs.`), 400);
        setTimeout(() => (this.naming = true), 900);
        break;
    }
  }

  say(text, ms = 2200) {
    if (!text) return;
    const id = ++seq;
    this.bubble = { text, id };
    setTimeout(() => this.bubble?.id === id && (this.bubble = null), ms);
  }

  play(name, ms = 1100) {
    const id = ++seq;
    this.fx = { name, id };
    setTimeout(() => this.fx?.id === id && (this.fx = null), ms);
  }

  showToast(text) {
    const id = ++seq;
    this.toast = { text, id };
    setTimeout(() => this.toast?.id === id && (this.toast = null), 2800);
  }

  async act(action, arg) {
    const res = await api.act(action, arg);
    this.apply(res);
    const r = res.result;
    if (r) {
      if (r.say) this.say(r.say);
      if (r.fx) this.play(r.fx, r.fx === 'eat' ? 1500 : 1100);
      if (r.ok && (r.fx === 'sleep' || r.fx === 'wake')) sfx(r.fx); // the rest are timed by the 3D stage
    }
    return r;
  }

  async hatchTap() {
    this.apply(await api.hatchTap());
  }

  async rename(name) {
    this.apply(await api.rename(name));
  }

  async saveRoom(layout) {
    this.apply(await api.saveRoom(layout));
  }

  async startEgg(answers) {
    this.apply(await api.startEgg(answers));
  }
}

export const game = new Game();
