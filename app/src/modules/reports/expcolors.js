// Fixed colours per expense category so charts look the same everywhere.
import { C, SERIES } from './viz.jsx';
const CAT_COLORS = { rent: C.navy, salaries: C.teal, transport: C.sun, utilities: C.plum, supplies: C.tealD, airtime: C.mpesa, repairs: C.coral, other: C.mute };
export const catColor = (id, i = 0) => CAT_COLORS[id] || SERIES[(i + 3) % SERIES.length];
