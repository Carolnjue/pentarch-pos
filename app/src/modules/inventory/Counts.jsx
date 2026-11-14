// Stock takes: list + "Start a count" (everything / some categories / only the items you scan; blind option).
import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { catalog } from '../../db/catalog.js';
import { PageHeader, Btn, Icon, Empty, Switch, Input } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { openModal, Modal, toast, hasModal } from '../../ui/overlay.jsx';
import { money } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { createCount, countScope } from '../../core/inventory.js';
import { StockTabs, StatusPill, d8, userName, branchName, multiBranch } from './common.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function Counts({ query }) {
  const [rows, setRows] = useState(null);
  const load = async () => setRows((await db().stock_counts.toArray()).filter((c) => !c.deleted && c.status !== 'cancelled').sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.created_at - a.created_at));
  useEffect(() => { load(); return on('change', (e) => e === 'stock_counts' && load()); }, []);
  useEffect(() => { if (query?.new && !hasModal()) { navigate('/inventory/counts', { replace: true }); startCount(); } }, [query?.new]);
  const open = (rows || []).filter((c) => c.status === 'open' && c.branch_id === S.branch.value?.id);
  return (
    <div class="page wide" style={{ maxWidth: '1400px' }}>
      <PageHeader title={t('Stock')} sub={t('Count stock: compare what is on the shelf with what the system says')} actions={<Btn variant="primary" icon="plus" onClick={startCount}>{t('Start a count')}</Btn>} />
      <StockTabs active="/inventory/counts" />
      {open.length > 0 && <div class="callout warn mb"><Icon name="info" size={18} /><span class="grow">{tn(open.length, 'You have {n} count in progress.', 'You have {n} counts in progress.')}</span><Btn size="sm" onClick={() => navigate('/inventory/counts/' + open[0].id)}>{t('Continue counting')}</Btn></div>}
      <div class="card">
        {!rows ? <div style={{ height: '200px' }} /> : (
          <Table rows={rows} onRowClick={(c) => navigate('/inventory/counts/' + c.id)}
            empty={<Empty icon="list" title={t('No stock counts yet')} text={t('Count your stock every month (or every week for fast items). Start with one shelf or category — it only takes a few minutes.')}><Btn variant="primary" icon="plus" onClick={startCount}>{t('Start a count')}</Btn></Empty>}
            columns={[
              { key: 'no', label: t('Count'), render: (c) => <div><b class="mono">{c.no}</b>{c.name && <div class="small mute">{c.name}</div>}</div> },
              { key: 'created_at', label: t('Started'), render: (c) => d8(c.created_at) },
              { key: 'scope', label: t('What'), hideMobile: true, render: (c) => scopeLabel(c) },
              ...(multiBranch() ? [{ key: 'branch', label: t('Branch'), hideMobile: true, render: (c) => branchName(c.branch_id) }] : []),
              { key: 'by', label: t('By'), hideMobile: true, render: (c) => userName(c.started_by).split(' ')[0] || '—' },
              { key: 'n', label: t('Counted'), num: true, render: (c) => (c.lines || []).filter((l) => l.counted != null).length },
              ...(can('products.cost_view') ? [{ key: 'v', label: t('Difference'), num: true, hideMobile: true, render: (c) => (c.status === 'applied' ? <span class={(c.gain || 0) + (c.loss || 0) < 0 ? 'down' : ''}>{money((c.gain || 0) + (c.loss || 0))}</span> : <span class="mute">—</span>) }] : []),
              { key: 'status', label: t('Status'), render: (c) => <StatusPill s={c.status} /> }
            ]} />
        )}
      </div>
    </div>
  );
}
export function scopeLabel(c) {
  if (c.scope === 'category') return (c.category_ids || []).map((id) => catalog.value.catById.get(id)?.name).filter(Boolean).join(', ') || t('Some categories');
  if (c.scope === 'custom') return t('Chosen items');
  return t('Everything');
}

export const startCount = () => openModal((close) => <StartCount close={close} />);
function StartCount({ close }) {
  const [scope, setScope] = useState('full');
  const [cats, setCats] = useState([]);
  const [blind, setBlind] = useState(!!S.settings.value.inv_blind_default);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const n = countScope({ scope, category_ids: cats, lines: [] }).length;
  const go = async () => {
    setBusy(true);
    const c = await createCount({ scope, category_ids: cats, blind, name });
    toast(t('Count {no} started', { no: c.no }));
    close(c);
    navigate('/inventory/counts/' + c.id);
  };
  const opt = (v, icon, title, sub) => (
    <button type="button" class={'inv-act' + (scope === v ? ' hero' : '')} role="radio" aria-checked={scope === v} onClick={() => setScope(v)}>
      <span class="ib" style={scope === v ? { background: 'var(--coral-d)', color: '#fff' } : { background: 'var(--navy-50)', color: 'var(--navy)' }}><Icon name={icon} size={20} /></span>
      <span class="grow"><b>{title}</b><small>{sub}</small></span>
    </button>
  );
  return (
    <Modal title={t('Start a count')} icon="list" size="lg" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" icon="arrow-right" disabled={busy || (scope === 'category' && !cats.length)} onClick={go}>{t('Start counting')}</Btn></>}>
      <div class="col gap-l">
        <div>
          <div class="lbl" style={{ marginBottom: '8px' }}>{t('What will you count?')}</div>
          <div class="col gap-s" role="radiogroup">
            {opt('full', 'layers', t('Everything'), t('A full stock take of all items'))}
            {opt('category', 'tags', t('Some categories'), t('e.g. only Drinks, or one shelf'))}
            {opt('custom', 'barcode', t('Only the items I scan'), t('Spot check: scan or pick the items you want to check'))}
          </div>
        </div>
        {scope === 'category' && <div class="row wrap gap-s">{catalog.value.categories.map((k) => <button type="button" class={'chip' + (cats.includes(k.id) ? ' on' : '')} onClick={() => setCats(cats.includes(k.id) ? cats.filter((x) => x !== k.id) : [...cats, k.id])}><i class="sw-dot" style={{ background: k.color }} />{k.name}</button>)}</div>}
        {scope !== 'custom' && <p class="small mute" style={{ margin: 0 }}>{tn(n, '{n} item to count', '{n} items to count')}</p>}
        <Switch checked={blind} onChange={setBlind} label={t('Blind count')} sub={t('Hide the system quantity while counting, so staff count what is really there. A manager sees the differences at the end.')} />
        <Input label={t('Name (optional)')} value={name} onValue={setName} placeholder={t('e.g. Shelf A, month end')} />
      </div>
    </Modal>
  );
}
