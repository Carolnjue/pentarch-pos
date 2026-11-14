// Tiny event bus. Events: 'change' (entity, ids), 'sale' (sale), 'scan' (code), 'route' (path)
const handlers = {};
export const on = (ev, fn) => { (handlers[ev] ||= new Set()).add(fn); return () => handlers[ev].delete(fn); };
export const emit = (ev, ...args) => { handlers[ev]?.forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } }); };
