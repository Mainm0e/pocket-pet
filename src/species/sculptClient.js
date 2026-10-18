// Ask the sculpt worker for a mesh (cached per shape). Falls back to the main thread.
import { sculptBody, sculptHead, sculptTail } from './shiba/sculpt.js';
import { sculptMochi } from './mochi/sculpt.js';

// kind is "species:part", e.g. "mochi:body"
const FN = { 'shiba:body': sculptBody, 'shiba:head': sculptHead, 'shiba:tail': sculptTail, 'mochi:body': sculptMochi };
const cache = new Map();
const waiting = new Map();
let worker = null;
let seq = 0;

function getWorker() {
  if (worker !== null) return worker;
  try {
    worker = new Worker(new URL('./sculpt.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const w = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.error) w?.reject(new Error(data.error));
      else w?.resolve(data.out);
    };
    worker.onerror = () => {
      worker = false;
      for (const [, w] of waiting) w.reject(new Error('sculpt worker failed'));
      waiting.clear();
    };
  } catch {
    worker = false;
  }
  return worker;
}

export function sculpt(kind, params) {
  const key = kind + JSON.stringify(params);
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  const w = getWorker();
  const job = w
    ? new Promise((resolve, reject) => {
        const id = ++seq;
        waiting.set(id, { resolve, reject });
        w.postMessage({ id, kind, params });
      }).catch(() => FN[kind](params))
    : new Promise((r) => setTimeout(r, 0)).then(() => FN[kind](params));
  cache.set(key, job);
  return job;
}
