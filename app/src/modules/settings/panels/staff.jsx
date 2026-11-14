// Staff & roles: users with PINs, branches, discount limits, commission; editable permission matrix.
import { useState } from 'preact/hooks';
import { Btn, Icon, Input, Select, Switch, Avatar, Badge, Tabs } from '../../../ui/kit.jsx';
import { openModal, Modal, toast, confirm } from '../../../ui/overlay.jsx';
import { save } from '../../../db/repo.js';
import { db } from '../../../db/index.js';
import { setUserPin, saveBusiness, hashPin } from '../../../auth/session.js';
import { ROLES, ROLE_LABELS, allPerms, roleHas, can } from '../../../auth/permissions.js';
import { normPhone, prettyPhone, groupBy } from '../../../lib/util.js';
import { Panel } from './general.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

export default function StaffPanel() {
  const [tab, setTab] = useState('staff');
  return (
    <div>
      <Tabs value={tab} onValue={setTab} tabs={[{ value: 'staff', label: t('Staff'), icon: 'users' }, { value: 'roles', label: t('Role permissions'), icon: 'shield' }]} />
      {tab === 'staff' ? <StaffList /> : <Matrix />}
    </div>
  );
}
function StaffList() {
  const all = S.users.value;
  const [showOff, setShowOff] = useState(false);
  const [inactive, setInactive] = useState([]);
  const loadOff = async () => setInactive((await db().users.toArray()).filter((u) => u.active === false && !u.deleted));
  return (
    <Panel title={t('Staff')} sub={t('Everyone gets their own PIN so every sale, discount and void is traceable.')} extra={<Btn variant="primary" icon="user-plus" onClick={() => editUser()}>{t('Add staff')}</Btn>}>
      <div class="card" style={{ margin: '-4px 0 0' }}>
        {all.map((u) => (
          <div class="list-item click" onClick={() => editUser(u)}>
            <Avatar name={u.name} />
            <div class="grow"><b>{u.name}</b>{u.id === S.user.value?.id && <Badge tone="ok">{t('You')}</Badge>}<div class="small mute">{prettyPhone(u.phone)}{u.max_discount_pct ? ' · ' + t('discount up to {n}%', { n: u.max_discount_pct }) : ''}{u.commission_pct ? ' · ' + t('{n}% commission', { n: u.commission_pct }) : ''}</div></div>
            <Badge tone={u.role === 'owner' ? 'ink' : u.role === 'manager' ? 'navy' : ''}>{t(ROLE_LABELS[u.role])}</Badge>
            <Icon name="chevron-right" size={18} />
          </div>
        ))}
      </div>
      <button class="btn ghost sm mt" onClick={() => { setShowOff(!showOff); loadOff(); }}>{showOff ? t('Hide inactive staff') : t('Show inactive staff')}</button>
      {showOff && inactive.map((u) => <div class="list-item click" onClick={() => editUser(u)}><Avatar name={u.name} /><span class="grow mute">{u.name}</span><Badge>{t('Inactive')}</Badge></div>)}
    </Panel>
  );
}
export const editUser = (u) => openModal((close) => <UserEdit u={u} close={close} />);
function UserEdit({ u, close }) {
  const [f, setF] = useState(u ? { ...u, phone: prettyPhone(u.phone) } : { name: '', phone: '', role: 'cashier', branch_ids: [], active: true, max_discount_pct: 5, commission_pct: 0 });
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const set = (p) => setF({ ...f, ...p });
  const owners = S.users.value.filter((x) => x.role === 'owner');
  const isLastOwner = u?.role === 'owner' && owners.length <= 1;
  const go = async () => {
    if (!f.name.trim()) return toast.error(t('Enter a name'));
    if (!u && !pin) return toast.error(t('Set a 4-digit PIN'));
    if (pin && !/^\d{4,6}$/.test(pin)) return toast.error(t('PIN must be 4–6 digits'));
    if (pin && pin !== pin2) return toast.error(t('PINs do not match'));
    if (pin && /^(\d)\1+$/.test(pin) && !(await confirm({ title: t('Weak PIN'), message: t('{p} is easy to guess. Use it anyway?', { p: pin }), ok: t('Use it') }))) return;
    if (pin) { const h = hashPin(pin); const clash = (await db().users.toArray()).find((x) => x.pin_hash === h && x.id !== u?.id && !x.deleted); if (clash) return toast.error(t('Another person already uses this PIN')); }
    if (isLastOwner && (f.role !== 'owner' || f.active === false)) return toast.error(t('The business needs at least one active owner'));
    if (f.role === 'owner' && S.user.value?.role !== 'owner') return toast.error(t('Only an owner can create owners'));
    const rec = { ...f, name: f.name.trim(), phone: normPhone(f.phone), max_discount_pct: +f.max_discount_pct || 0, commission_pct: +f.commission_pct || 0 };
    if (pin) await setUserPin(rec, pin);
    delete rec.demo_pin;
    await save('users', rec, { audit: { action: u ? (pin ? 'user.pin_change' : 'user.update') : 'user.create', details: { name: rec.name, role: rec.role } } });
    toast(u ? t('Saved') : t('{name} can now sign in with their PIN', { name: rec.name }));
    close(true);
  };
  return (
    <Modal title={u ? f.name : t('Add staff')} icon="user" size="lg" onClose={() => close(false)} footer={<><Btn onClick={() => close(false)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={go}>{t('Save')}</Btn></>}>
      <div class="form-grid">
        <Input label={t('Full name')} value={f.name} onValue={(v) => set({ name: v })} autoFocus={!u} />
        <Input label={t('Phone')} type="tel" value={f.phone} onValue={(v) => set({ phone: v })} />
        <Select label={t('Role')} value={f.role} onValue={(v) => set({ role: v, max_discount_pct: v === 'owner' ? 100 : v === 'manager' ? 15 : f.max_discount_pct })} disabled={isLastOwner}
          options={ROLES.filter((r) => r !== 'owner' || S.user.value?.role === 'owner').map((r) => ({ value: r, label: t(ROLE_LABELS[r]) }))} />
        <Input label={u ? t('New PIN (leave empty to keep)') : t('PIN (4 digits)')} type="password" inputMode="numeric" value={pin} onValue={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} inputClass="mono" autocomplete="new-password" />
        <Input label={t('Repeat PIN')} type="password" inputMode="numeric" value={pin2} onValue={(v) => setPin2(v.replace(/\D/g, '').slice(0, 6))} inputClass="mono" autocomplete="new-password" />
        <Input label={t('Maximum discount %')} type="number" value={f.max_discount_pct} onValue={(v) => set({ max_discount_pct: v })} hint={t('Above this a manager must approve')} />
        {(S.modulesOn.value.services || f.commission_pct > 0) && <Input label={t('Commission % on services')} type="number" value={f.commission_pct} onValue={(v) => set({ commission_pct: v })} />}
        {S.branches.value.length > 1 && (
          <div class="field full"><label>{t('Branches (none = all)')}</label><div class="row wrap gap-s">{S.branches.value.map((b) => <button class={'chip' + (f.branch_ids?.includes(b.id) ? ' on' : '')} onClick={() => set({ branch_ids: f.branch_ids?.includes(b.id) ? f.branch_ids.filter((x) => x !== b.id) : [...(f.branch_ids || []), b.id] })}>{b.name}</button>)}</div></div>
        )}
        <div class="full"><Switch checked={f.active !== false} disabled={isLastOwner || u?.id === S.user.value?.id} onChange={(v) => set({ active: v })} label={t('Active')} sub={t('Inactive staff cannot sign in. Their history is kept.')} /></div>
      </div>
      <div class="callout mt"><Icon name="shield" size={18} /><span class="small">{t('What this role can do is set under Role permissions.')}</span></div>
    </Modal>
  );
}
function Matrix() {
  const [ov, setOv] = useState(JSON.parse(JSON.stringify(S.settings.value.role_perms || {})));
  const edit = can('roles.edit');
  const perms = allPerms();
  const groups = groupBy(perms, (p) => p.group);
  const roles = ROLES.filter((r) => r !== 'owner');
  const toggle = (r, k) => { const cur = roleHas(r, k, ov); setOv({ ...ov, [r]: { ...(ov[r] || {}), [k]: !cur } }); };
  return (
    <Panel title={t('Role permissions')} sub={t('Owners can do everything. Tick what each other role may do.')} onSave={edit ? async () => { await saveBusiness({ settings: { role_perms: ov } }, 'roles.change'); toast(t('Saved')); } : null}
      extra={edit && <Btn size="sm" onClick={async () => { if (await confirm({ title: t('Reset to recommended?'), ok: t('Reset') })) setOv({}); }}>{t('Reset')}</Btn>}>
      <div style={{ overflowX: 'auto', margin: '0 -18px' }}>
        <table class="table perm-table">
          <thead><tr><th>{t('Permission')}</th><th>{t('Owner')}</th>{roles.map((r) => <th>{t(ROLE_LABELS[r])}</th>)}</tr></thead>
          <tbody>
            {Object.entries(groups).map(([g, list]) => <>
              <tr><td colSpan={roles.length + 2} style={{ background: 'var(--paper)', fontWeight: 700, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--mute)' }}>{t(g)}</td></tr>
              {list.map((p) => <tr><td>{t(p.label)}</td><td><Icon name="check" size={16} style={{ margin: '0 auto', color: 'var(--teal-d)' }} /></td>
                {roles.map((r) => <td><input type="checkbox" checked={roleHas(r, p.key, ov)} disabled={!edit} aria-label={`${t(ROLE_LABELS[r])}: ${t(p.label)}`} onChange={() => toggle(r, p.key)} style={{ width: '18px', height: '18px', accentColor: 'var(--teal-d)' }} /></td>)}</tr>)}
            </>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
