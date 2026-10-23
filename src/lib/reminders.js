// Reminders ("Your pet is hungry!"), best effort without a push server.
// The game rules work out what the pet will need next (api.forecast). When the player
// leaves, we hand that list to the service worker (in a small cache it can read), and:
//  - an installed app on Chrome gets woken now and then (Periodic Background Sync) and
//    shows whatever is due;
//  - while the page is still alive in the background, we show it on time ourselves.
// A real Web Push server can later send the same list; nothing else needs to change.
// UI-only: these timers only SHOW notifications, they never change game state.
import { api } from './api.js';

const PREF = 'pocketpet.reminders';
export const STORE = 'pocket-pet-reminders'; // also in public/sw.js
export const KEY = '/__reminders.json';

const TEXT = {
  hungry: (n) => [`${n} is getting hungry 🍙`, 'A little snack would make its day.'],
  lonely: (n) => [`${n} misses you 💭`, 'Come and play for a bit?'],
  mess: (n) => [`Uh-oh, ${n} made a mess 🧹`, 'Tidy up and it will love you for it.'],
  wish: (n, w) => [`${n} is still wishing ✨`, w ? `Today it wants ${w}.` : 'It has a wish for today.'],
};

export const supported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'caches' in window;

export function isOn() {
  try {
    // the switch decides; only an explicit browser block turns it off (some browsers report
    // 'default' even after granting, and the service worker simply can't show anything then)
    return supported() && Notification.permission !== 'denied' && localStorage.getItem(PREF) === '1';
  } catch {
    return false;
  }
}

/** Turn reminders on (asks for permission). Returns 'on' | 'denied' | 'unsupported'. */
export async function turnOn() {
  if (!supported()) return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (p !== 'granted') return 'denied';
  try {
    localStorage.setItem(PREF, '1');
  } catch {
    /* fine: just not remembered */
  }
  await registerWake();
  await save();
  return 'on';
}

export async function turnOff() {
  try {
    localStorage.setItem(PREF, '0');
  } catch {
    /* ignore */
  }
  clearTimers();
  try {
    await caches.delete(STORE);
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.periodicSync?.unregister('pet-check');
  } catch {
    /* ignore */
  }
}

/** Ask the browser to wake the installed app now and then to check (Chrome, installed PWA only). */
async function registerWake() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const st = await navigator.permissions?.query({ name: 'periodic-background-sync' });
    if (reg.periodicSync && (!st || st.state === 'granted')) await reg.periodicSync.register('pet-check', { minInterval: 60 * 60_000 });
  } catch {
    /* not supported: the in-page timers still work while the page is alive */
  }
}

/** Save what's coming up, worded for notifications, where the service worker can read it. */
export async function save(force = false) {
  if (!force && !isOn()) return [];
  const r = await api.forecast();
  const items = (r.forecast ?? []).map((f) => {
    const [title, body] = TEXT[f.kind](r.name, r.wish);
    return { id: f.id, kind: f.kind, at: f.at, title, body };
  });
  try {
    const c = await caches.open(STORE);
    const old = await (await c.match(KEY))?.json().catch(() => null);
    await c.put(KEY, new Response(JSON.stringify({ items, shown: old?.shown ?? [] })));
  } catch {
    /* storage blocked */
  }
  return items;
}

// ---- while the page is still alive in the background ----
let timers = [];
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}
async function showDue(now = Date.now()) {
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.active?.postMessage({ type: 'check-reminders', now });
}

/** The player left: save the forecast and keep an eye on the next few hours. */
export async function onHide() {
  if (!isOn()) return;
  const items = await save();
  clearTimers();
  for (const it of items) {
    const ms = it.at - Date.now();
    if (ms > 0 && ms < 6 * 3600_000) timers.push(setTimeout(() => document.hidden && showDue(), ms + 1000));
  }
}

/** The player is back: no need for reminders on screen any more. */
export async function onShow() {
  clearTimers();
  if (!supported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    for (const n of (await reg?.getNotifications()) ?? []) n.close();
  } catch {
    /* ignore */
  }
}

/** For tests (?dev): save now, and ask the service worker to show what's due by `now`. */
export const devTools = { save: () => save(true), isOn };
