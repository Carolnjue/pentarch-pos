import Dexie from 'dexie';
import { STORES, VERSION } from './schema.js';

export const DB_LIVE = 'pentarch-pos';
export const DB_DEMO = 'pentarch-pos-demo';

/** The currently open database. Always import `db()` — never cache the instance (it swaps on demo/live switch). */
let current = null;
export const db = () => current;
export const isDemoDb = () => current?.name === DB_DEMO;

export async function openDb(name) {
  if (current && current.name === name) return current;
  if (current) current.close();
  const d = new Dexie(name);
  d.version(VERSION).stores(STORES);
  await d.open();
  current = d;
  return d;
}

export async function deleteDb(name) {
  if (current?.name === name) { current.close(); current = null; }
  await Dexie.delete(name);
}

export const getMeta = async (key, dflt = null) => (await current.meta.get(key))?.value ?? dflt;
export const setMeta = (key, value) => current.meta.put({ key, value });
