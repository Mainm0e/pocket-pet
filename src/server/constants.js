// Tuning knobs. Kept server-side: the client never decides any of these.

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export const CARE_KEYS = ['happiness', 'comfort', 'health', 'fitness', 'energy'];
export const CARE_FLOOR = 5; // pets never hit zero, never die
export const CARE_MAX = 100;

export const TRAITS = ['tough', 'playful', 'strong', 'calm'];
export const TRAIT_CAP = 150; // shared total: pets differ in shape, not power
export const DAILY_TRAIT_GAIN = 20; // time gate on growth
export const TALENT_MULT = 1.5;

export const STAGES = ['egg', 'baby', 'teen', 'adult'];
export const HATCH_TAPS = 5;
export const TEEN_AGE = 1 * DAY;
export const TEEN_TRAITS = 25;
export const ADULT_AGE = 3 * DAY;
export const ADULT_TRAITS = 70;

export const BATTLES_PER_DAY = 5;
export const MAX_CATCHUP = 7 * DAY; // decay stops accumulating after a week away
export const MAX_POOPS = 4;

export const SEASON = { id: 1, species: 'mochi', name: 'Season 1 · Mochi' };

// Body shape at Teen (top trait) and feature at Adult (second trait).
// Fallback form names (each species' gene table has its own FORMS).
export const FORMS = {
  strong: { noun: 'Spikeling', adj: 'Mighty', bodyDesc: 'Soft spikes', featureDesc: 'Little horns' },
  playful: { noun: 'Bunbun', adj: 'Bouncy', bodyDesc: 'Bunny ears', featureDesc: 'Curly tail' },
  tough: { noun: 'Pudgeling', adj: 'Chunky', bodyDesc: 'Chubby with a belly', featureDesc: 'Chunky feet' },
  calm: { noun: 'Sproutling', adj: 'Dreamy', bodyDesc: 'Tall with a leaf', featureDesc: 'Halo' },
};

export const TRAIT_INFO = {
  tough: { label: 'Tough', from: 'Feeding' },
  playful: { label: 'Playful', from: 'Playing' },
  strong: { label: 'Strong', from: 'Training' },
  calm: { label: 'Calm', from: 'Bath, sleep & cleaning' },
};

export const TEMPERAMENTS = {
  bold: { label: 'Bold', desc: '+10% attack in battle' },
  shy: { label: 'Shy', desc: '+15% defense in battle' },
  stubborn: { label: 'Stubborn', desc: 'May ignore your cheers when unhappy' },
  cheerful: { label: 'Cheerful', desc: 'Good-mood battle bonus is doubled' },
};

export const QUIRKS = {
  loves_rain: { label: 'Loves rain', desc: 'Stays happy for longer on rainy days' },
  hates_baths: { label: 'Hates baths', desc: 'Baths make it grumpy (but still clean)' },
  snack_lover: { label: 'Snack lover', desc: 'Food makes it extra happy' },
  neat_freak: { label: 'Neat freak', desc: 'Messes bother it twice as much' },
  sleepyhead: { label: 'Sleepyhead', desc: 'Tires faster, recharges faster' },
  night_owl: { label: 'Night owl', desc: 'Has more energy at night' },
};

// Rolled by the genome (genome/shiba-g1.js); these are the display texts.
export const MUTATIONS = {
  shiny: { label: 'Shiny', desc: 'Sparkles all over' },
  hetero: { label: 'Heterochromia', desc: 'Two different eye colours' },
};

export const MARKS = {
  star: { label: 'Victory star', desc: 'Won its first battle' },
  scar: { label: 'Rival scar', desc: 'Won 3 battles' },
  aura: { label: 'Loved aura', desc: 'Grew up to an adult with great care' },
  sun: { label: 'Sunny mark', desc: 'Visited 3 days in a row' },
  rainbow: { label: 'Rainbow mark', desc: 'Visited 7 days in a row' },
};
