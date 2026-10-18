// The player's room layout: purely cosmetic, but still checked by the server so a
// save can never hold broken or unbounded data.

/** What can go in a room. limit = max count, required = always at least one. */
export const ROOM_ITEMS = {
  bed: { label: 'Bed', limit: 1, required: true },
  bowl: { label: 'Food bowl', limit: 1, required: true },
  ball: { label: 'Toy ball', limit: 1 },
  plant: { label: 'Plant', limit: 4 },
  lamp: { label: 'Lamp', limit: 2 },
  cushion: { label: 'Cushion', limit: 3 },
  toybox: { label: 'Toy box', limit: 1 },
  rug: { label: 'Rug', limit: 2 },
};
export const WALLS = ['pink', 'mint', 'sky', 'cream', 'lilac'];
export const FLOORS = ['oak', 'maple', 'checker', 'tatami'];
export const RUGS = ['sky', 'peach', 'mint', 'lilac', 'lemon'];
/** Where furniture may stand (floor area that is in view on a phone). */
export const ROOM_BOUNDS = { x: 1.3, zMin: -1.6, zMax: 1.0 };
const MAX_ITEMS = 14;

export const DEFAULT_ROOM = {
  wall: 'pink',
  floor: 'oak',
  rug: 'sky',
  items: [
    { id: 'rug1', kind: 'rug', x: 0, z: 0.15, rot: 0 },
    { id: 'bed1', kind: 'bed', x: -0.62, z: -1.0, rot: 0 },
    { id: 'bowl1', kind: 'bowl', x: 0.92, z: 0.45, rot: 0 },
    { id: 'ball1', kind: 'ball', x: 0.7, z: -1.1, rot: 0 },
    { id: 'plant1', kind: 'plant', x: 1.2, z: -1.5, rot: 0 },
    { id: 'lamp1', kind: 'lamp', x: -1.2, z: -1.5, rot: 0, on: true },
  ],
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

/** Make any input a valid room: known items only, within limits and bounds, required items present. */
export function sanitizeRoom(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {
    wall: WALLS.includes(src.wall) ? src.wall : DEFAULT_ROOM.wall,
    floor: FLOORS.includes(src.floor) ? src.floor : DEFAULT_ROOM.floor,
    rug: RUGS.includes(src.rug) ? src.rug : DEFAULT_ROOM.rug,
    items: [],
  };
  const counts = {};
  const ids = new Set();
  for (const it of Array.isArray(src.items) ? src.items : []) {
    if (!it || !ROOM_ITEMS[it.kind] || out.items.length >= MAX_ITEMS) continue;
    counts[it.kind] = (counts[it.kind] ?? 0) + 1;
    if (counts[it.kind] > ROOM_ITEMS[it.kind].limit) continue;
    let id = String(it.id ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || `${it.kind}${counts[it.kind]}`;
    while (ids.has(id)) id += 'x';
    ids.add(id);
    const item = {
      id,
      kind: it.kind,
      x: +clamp(num(it.x), -ROOM_BOUNDS.x, ROOM_BOUNDS.x).toFixed(3),
      z: +clamp(num(it.z), ROOM_BOUNDS.zMin, ROOM_BOUNDS.zMax).toFixed(3),
      rot: +(((num(it.rot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(3),
    };
    if (it.kind === 'lamp') item.on = it.on !== false;
    out.items.push(item);
  }
  for (const [kind, def] of Object.entries(ROOM_ITEMS)) {
    if (def.required && !counts[kind]) out.items.push({ ...DEFAULT_ROOM.items.find((i) => i.kind === kind) });
  }
  return out;
}
