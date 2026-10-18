// Sculpting runs here, off the main thread (every species).
import { sculptBody, sculptHead, sculptTail } from './shiba/sculpt.js';
import { sculptMochi } from './mochi/sculpt.js';

const FN = { 'shiba:body': sculptBody, 'shiba:head': sculptHead, 'shiba:tail': sculptTail, 'mochi:body': sculptMochi };
self.onmessage = ({ data: { id, kind, params } }) => {
  try {
    const out = FN[kind](params);
    const m = out.mesh;
    self.postMessage({ id, out }, [m.position.buffer, m.normal.buffer, m.color.buffer, m.index.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
