// Permission registry. Modules register keys with default roles; the owner can override per role
// in Settings → Staff & roles (stored in business.settings.role_perms). Owner always has everything.
import { user, settings } from '../state.js';

export const ROLES = ['owner', 'manager', 'cashier', 'waiter', 'stock', 'accountant'];
export const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter', stock: 'Stock clerk', accountant: 'Accountant' };
const PERMS = new Map();
const ALL = ROLES;
const MGR = ['owner', 'manager'];

/** Register permission definitions: [{key, label, group, roles:[...]}] */
export function registerPerms(list) { for (const p of list || []) PERMS.set(p.key, p); }
export const allPerms = () => [...PERMS.values()];

export function roleHas(role, key, overrides = settings.value.role_perms) {
  if (role === 'owner') return true;
  const o = overrides?.[role]?.[key];
  if (o !== undefined) return !!o;
  const def = PERMS.get(key);
  return !!def && def.roles.includes(role);
}
/** Does the user (default: current) have the permission? */
export const can = (key, u = user.value) => !!u && roleHas(u.role, key);

// Core permissions (shell, settings, staff, audit). Feature modules register their own.
registerPerms([
  { key: 'dashboard.view', label: 'View dashboard & sales figures', group: 'General', roles: ['owner', 'manager', 'accountant'] },
  { key: 'settings.view', label: 'Open settings', group: 'Settings', roles: MGR },
  { key: 'settings.edit', label: 'Change settings', group: 'Settings', roles: MGR },
  { key: 'staff.manage', label: 'Manage staff & PINs', group: 'Settings', roles: MGR },
  { key: 'roles.edit', label: 'Edit role permissions', group: 'Settings', roles: ['owner'] },
  { key: 'billing.manage', label: 'Licence & billing', group: 'Settings', roles: ['owner'] },
  { key: 'backup.manage', label: 'Backup, restore & clear data', group: 'Settings', roles: ['owner'] },
  { key: 'export.data', label: 'Export data (CSV / JSON)', group: 'Settings', roles: ['owner', 'manager', 'accountant'] },
  { key: 'audit.view', label: 'View audit log', group: 'Settings', roles: ['owner', 'manager', 'accountant'] },
  { key: 'business.delete', label: 'Delete business data', group: 'Settings', roles: ['owner'] },
  { key: 'branches.manage', label: 'Manage branches & devices', group: 'Settings', roles: ['owner'] },
  { key: 'branches.switch', label: 'Switch branch on this device', group: 'General', roles: MGR }
]);
export { ALL, MGR };
