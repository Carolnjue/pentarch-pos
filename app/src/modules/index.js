// Registry helpers: collect routes, nav, widgets, settings panels, commands and shortcuts from enabled modules.
import { MODULES } from './registry.js';
import { registerPerms, can } from '../auth/permissions.js';
import { business } from '../state.js';

for (const m of MODULES) registerPerms(m.permissions);

const on = (m) => !m.enabled || m.enabled(business.value || {});
export const enabledModules = () => MODULES.filter(on);
export const allRoutes = () => MODULES.flatMap((m) => (m.routes || []).map((r) => ({ ...r, module: m.id, enabled: () => on(m) })));
export const navItems = () => enabledModules().flatMap((m) => m.nav || []).filter((n) => !n.perm || can(n.perm)).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
// A later module may replace an earlier module's widget by registering the same id (e.g. inventory's 'low' replaces home's).
export const widgets = () => [...new Map(enabledModules().flatMap((m) => m.widgets || []).map((w) => [w.id, w])).values()].filter((w) => (!w.perm || can(w.perm)) && (!w.when || w.when())).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
export const settingsPanels = () => enabledModules().flatMap((m) => m.settings || []).filter((s) => !s.perm || can(s.perm)).sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
export const commands = () => enabledModules().flatMap((m) => m.commands || []).filter((c) => !c.perm || can(c.perm));
export const shortcuts = () => enabledModules().flatMap((m) => m.shortcuts || []);
export { MODULES };
/** Sell-screen extensions from enabled modules: { CartBar, LineExtra, afterAdd(key, product), beforePay(), onHold() } (see ARCHITECTURE §6). */
export const sellExtensions = () => enabledModules().map((m) => m.sell).filter(Boolean);
