// The only door between UI and game logic. Today it calls the in-browser
// prototype server; later each method becomes a Supabase Edge Function call.
import { createServer } from '../server/index.js';

function pickStorage() {
  try {
    localStorage.setItem('__pp', '1');
    localStorage.removeItem('__pp');
    return localStorage;
  } catch {
    const m = new Map();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  }
}

export const api = createServer({ storage: pickStorage() });
