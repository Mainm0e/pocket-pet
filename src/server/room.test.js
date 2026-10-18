import { describe, it, expect } from 'vitest';
import { sanitizeRoom, DEFAULT_ROOM, ROOM_BOUNDS } from './room.js';
import { createServer } from './index.js';

describe('room layout', () => {
  it('keeps a valid layout as it is', () => {
    expect(sanitizeRoom(DEFAULT_ROOM)).toEqual(DEFAULT_ROOM);
  });
  it('drops unknown items, enforces limits and bounds, restores required items', () => {
    const r = sanitizeRoom({
      wall: 'neon', floor: 'lava',
      items: [
        { kind: 'spaceship', x: 0, z: 0 },
        ...Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, kind: 'plant', x: 99, z: -99 })),
        { id: 'bed1', kind: 'bed', x: 0, z: 0 },
        { id: 'bed2', kind: 'bed', x: 1, z: 0 },
      ],
    });
    expect(r.wall).toBe('pink');
    expect(r.floor).toBe('oak');
    expect(r.items.filter((i) => i.kind === 'plant')).toHaveLength(4);
    expect(r.items.filter((i) => i.kind === 'bed')).toHaveLength(1);
    expect(r.items.some((i) => i.kind === 'bowl')).toBe(true); // required, put back
    expect(r.items.some((i) => i.kind === 'spaceship')).toBe(false);
    for (const i of r.items) {
      expect(Math.abs(i.x)).toBeLessThanOrEqual(ROOM_BOUNDS.x);
      expect(i.z).toBeGreaterThanOrEqual(ROOM_BOUNDS.zMin);
    }
  });
  it('is saved through the server', async () => {
    const m = new Map();
    const s = createServer({ storage: { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }, clock: () => 0 });
    expect((await s.getState()).state.room).toEqual(DEFAULT_ROOM);
    const r = await s.saveRoom({ ...DEFAULT_ROOM, wall: 'mint', items: [...DEFAULT_ROOM.items, { id: 'c1', kind: 'cushion', x: 0.5, z: 0.5 }] });
    expect(r.state.room.wall).toBe('mint');
    expect(r.state.room.items.some((i) => i.kind === 'cushion')).toBe(true);
  });
});
