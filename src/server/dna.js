import { weightedPick } from './rng.js';
import { TRAITS, TEMPERAMENTS, QUIRKS } from './constants.js';
import { hash, streamFor } from './genome/core.js';
import { normalizeCode } from './genome/index.js';

// Playful questions only: no age, location, birthday or other real personal data.
export const QUIZ = [
  {
    q: 'Rainy day! What is the plan?',
    a: [
      { text: 'Blanket fort and cocoa', nudge: { calm: 2, shy: 1, sleepyhead: 1 } },
      { text: 'Splash in every puddle!', nudge: { playful: 2, loves_rain: 3 } },
    ],
  },
  {
    q: 'Pick a snack.',
    a: [
      { text: 'A giant bowl of noodles', nudge: { tough: 2, snack_lover: 2 } },
      { text: 'An apple, then a jog', nudge: { strong: 2, bold: 1 } },
    ],
  },
  {
    q: 'Someone waves at you from across the street.',
    a: [
      { text: 'Wave back with both arms', nudge: { cheerful: 2, bold: 1 } },
      { text: 'Hide behind a lamppost', nudge: { shy: 2, calm: 1 } },
    ],
  },
  {
    q: 'Your room is...',
    a: [
      { text: 'Spotless. Everything labelled.', nudge: { neat_freak: 3, calm: 1 } },
      { text: 'A glorious mess', nudge: { playful: 1, stubborn: 1, hates_baths: 2 } },
    ],
  },
  {
    q: 'Bedtime is...',
    a: [
      { text: 'Early. Sleep is life.', nudge: { sleepyhead: 3, calm: 1 } },
      { text: 'What bedtime? The stars are out!', nudge: { night_owl: 3, stubborn: 1 } },
    ],
  },
  {
    q: 'A friend challenges you to a race!',
    a: [
      { text: "You're on!", nudge: { strong: 1, bold: 2 } },
      { text: "Let's have a picnic instead", nudge: { tough: 1, cheerful: 2 } },
    ],
  },
];

function baseWeights(keys) {
  return Object.fromEntries(keys.map((k) => [k, 1]));
}

/** Quiz answers (array of answer indexes) -> nudge weights. Unknown input is ignored. */
export function quizWeights(answers = []) {
  const w = {
    talent: baseWeights(TRAITS),
    temperament: baseWeights(Object.keys(TEMPERAMENTS)),
    quirk: baseWeights(Object.keys(QUIRKS)),
  };
  answers.slice(0, QUIZ.length).forEach((ai, qi) => {
    const ans = QUIZ[qi]?.a[ai];
    if (!ans) return;
    for (const [k, v] of Object.entries(ans.nudge)) {
      for (const group of Object.values(w)) if (k in group) group[k] += v;
    }
  });
  return w;
}

/**
 * Roll a pet's personality. Looks come from the seed code (see genome/);
 * personality comes from its own stream of that seed, nudged by the quiz.
 */
export function createPersonality(code, answers) {
  const rng = streamFor(hash(normalizeCode(code)), 'personality');
  const w = quizWeights(answers);
  return {
    talent: weightedPick(rng, w.talent),
    temperament: weightedPick(rng, w.temperament),
    quirk: weightedPick(rng, w.quirk),
  };
}
