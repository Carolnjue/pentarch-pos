import { useEffect, useState } from 'preact/hooks';
import { Btn, Icon, Input, Badge, Textarea, Select } from '../../../ui/kit.jsx';
import { openModal, Modal, toast, confirm } from '../../../ui/overlay.jsx';
import { save } from '../../../db/repo.js';
import { db, getMeta, setMeta } from '../../../db/index.js';
import { saveBusiness, switchBranch, signOutDevice, loadState } from '../../../auth/session.js';
import { can } from '../../../auth/permissions.js';
import { licenceState } from '../../../auth/session.js';
import { normPhone, prettyPhone, relTime } from '../../../lib/util.js';
import { setCloudBase } from '../../../sync/api.js';
import { syncNow } from '../../../sync/client.js';
import { Panel, Row } from './general.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

export default function BranchesPanel() {
  const [devices, setDevices] = useState([]);
  const [cloud, setCloud] = useState(S.settings.value.cloud_url || '');
  const [rej, setRej] = useState([]);
  useEffect(() => { db().devices.toArray().then((d) => setDevices(d.filter((x) => !x.deleted))); getMeta('outbox_rejected').then((r) => setRej(r || [])); }, []);
  const manage = can('branches.manage');
  const lic = licenceState();
  return (
    <div class="col gap-l">
      <Panel title={t('Branches')} sub={t('Each branch keeps its own stock, cash and receipt numbers.')} extra={manage && <Btn icon="plus" variant="primary" onClick={async () => {
        if (S.branches.value.length >= (S.licence.value?.max_branches || 99) && !S.isDemo.value) return toast.error(t('Your plan allows {n} branches. Contact Pentarch to add more.', { n: S.licence.value.max_branches }));
        if (await editBranch()) { if (!S.modulesOn.value.multi_branch) await saveBusiness({ modules: { multi_branch: true } }); }
      }}>{t('Add branch')}</Btn>}>
        {S.branches.value.map((b) => (
          <div class="list-item">
            <span class="ico-bub" style={{ background: 'var(--navy-50)', color: 'var(--navy)' }}><Icon name="store" size={18} /></span>
            <div class="grow"><b>{b.name}</b> {b.is_main && <Badge tone="navy">{t('Main')}</Badge>} {b.id === S.branch.value?.id && <Badge tone="ok">{t('This device')}</Badge>}<div class="small mute">{b.code} · {b.address} {b.phone && '· ' + prettyPhone(b.phone)}</div></div>
            {b.id !== S.branch.value?.id && can('branches.switch') && <Btn size="sm" onClick={() => switchBranch(b.id).then(() => toast(t('This device now sells for {b}', { b: b.name })))}>{t('Use on this device')}</Btn>}
            {manage && <Btn size="sm" icon="edit" onClick={() => editBranch(b)}>{t('Edit')}</Btn>}
          </div>
        ))}
      </Panel>
      <Panel title={t('Devices')} sub={t('Tills and phones signed in to this business.')}>
        {devices.map((d) => (
          <div class="list-item">
            <span class="ico-bub" style={{ background: 'var(--paper-2)' }}><Icon name="monitor" size={18} /></span>
            <div class="grow"><b>{d.name}</b> {d.id === S.device.value.id && <Badge tone="ok">{t('This device')}</Badge>}<div class="small mute">{t('Till no. {n}', { n: d.no || '?' })} · {S.branches.value.find((b) => b.id === d.branch_id)?.name || ''}{d.last_seen ? ' · ' + relTime(d.last_seen, t) : ''}</div></div>
            {d.id === S.device.value.id && <Btn size="sm" icon="edit" onClick={async () => {
              const name = prompt(t('Name for this device'), d.name);
              if (name) { await save('devices', { ...d, name, last_seen: Date.now() }); await setMeta('device_name', name); S.device.value = { ...S.device.value, name }; setDevices(devices.map((x) => (x.id === d.id ? { ...x, name } : x))); }
            }}>{t('Rename')}</Btn>}
          </div>
        ))}
        {!devices.length && <div class="mute">{S.isDemo.value ? t('Devices appear here once the business is registered.') : t('This device registers with the cloud automatically when online.')}</div>}
      </Panel>
      {!S.isDemo.value && (
        <Panel title={t('Cloud sync')} sub={t('Your data syncs to Pentarch Cloud for backup and multi-device use.')}>
          <Row title={t('Status')} sub={S.sync.value.error || ''}><Badge tone={S.sync.value.state === 'error' ? 'bad' : S.sync.value.pending ? 'warn' : 'ok'}>{S.sync.value.pending ? t('{n} waiting', { n: S.sync.value.pending }) : S.sync.value.lastAt ? t('Synced {when}', { when: relTime(S.sync.value.lastAt, t) }) : t('Not synced yet')}</Badge><Btn size="sm" icon="refresh" onClick={() => syncNow('manual')}>{t('Sync now')}</Btn></Row>
          {rej.length > 0 && <div class="callout warn small"><Icon name="alert" size={16} /><span>{t('{n} changes were refused by the cloud and will be retried:', { n: rej.length })} {rej.slice(0, 3).map((r) => r.entity + ' ' + (r.reason || '')).join('; ')}</span></div>}
          {can('settings.edit') && <Row title={t('Cloud address (advanced)')} sub={t('Leave empty to use pentarchcommunications.com')}><input class="input mono" style={{ maxWidth: '300px' }} value={cloud} placeholder="https://…" aria-label={t('Cloud address')} onInput={(e) => setCloud(e.target.value)} /><Btn size="sm" onClick={async () => { await saveBusiness({ settings: { cloud_url: cloud.trim() } }); setCloudBase(cloud.trim()); toast(t('Saved')); }}>{t('Save')}</Btn></Row>}
          {S.user.value?.role === 'owner' && <Row title={t('Sign this device out')} sub={t('Removes this business from this device after everything has synced.')}><Btn size="sm" variant="danger" icon="logout" onClick={async () => {
            if (!(await confirm({ title: t('Sign out this device?'), message: t('Local data on this device will be removed. Your data stays safe in the cloud.'), danger: true, ok: t('Sign out') }))) return;
            try { await signOutDevice(); } catch (e) { toast.error(e.message); }
          }}>{t('Sign out')}</Btn></Row>}
        </Panel>
      )}
    </div>
  );
}
const editBranch = (b) => openModal((close) => <BranchEdit b={b} close={close} />);
function BranchEdit({ b, close }) {
  const [f, setF] = useState(b ? { ...b, phone: prettyPhone(b.phone) } : { name: '', code: '', address: '', phone: '', is_main: false, receipt_footer: '' });
  const set = (p) => setF({ ...f, ...p });
  const go = async () => {
    if (!f.name.trim()) return toast.error(t('Enter a name'));
    const code = (f.code || f.name.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase();
    if (S.branches.value.some((x) => x.code === code && x.id !== f.id)) return toast.error(t('Another branch uses code {c}', { c: code }));
    await save('branches', { ...f, name: f.name.trim(), code, phone: normPhone(f.phone) }, { audit: { action: b ? 'branch.update' : 'branch.create', details: { name: f.name } } });
    toast(t('Saved'));
    close(true);
  };
  return (
    <Modal title={b ? b.name : t('Add branch')} icon="store" onClose={() => close(false)} footer={<><Btn onClick={() => close(false)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={go}>{t('Save')}</Btn></>}>
      <div class="form-grid">
        <Input label={t('Branch name')} value={f.name} onValue={(v) => set({ name: v })} autoFocus />
        <Input label={t('Code (3 letters, on receipt numbers)')} value={f.code} onValue={(v) => set({ code: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })} inputClass="mono" disabled={!!b} />
        <Input class="full" label={t('Address')} value={f.address} onValue={(v) => set({ address: v })} />
        <Input label={t('Phone')} value={f.phone} onValue={(v) => set({ phone: v })} />
        <Textarea class="full" label={t('Receipt footer for this branch (optional)')} value={f.receipt_footer} onValue={(v) => set({ receipt_footer: v })} rows={2} />
      </div>
    </Modal>
  );
}
