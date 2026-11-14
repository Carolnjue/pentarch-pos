// Backup (JSON), restore, export everything (CSV zip), clear sample/demo data. Always available — even when the licence has expired.
import { useEffect, useState } from 'preact/hooks';
import { Btn, Icon, Badge } from '../../../ui/kit.jsx';
import { toast, confirm, promptText } from '../../../ui/overlay.jsx';
import { db, getMeta, setMeta } from '../../../db/index.js';
import { ENTITIES, isSynced } from '../../../db/schema.js';
import { audit, saveMany } from '../../../db/repo.js';
import { rebuildLevels } from '../../../db/stock.js';
import { loadState, resetDemo } from '../../../auth/session.js';
import { can } from '../../../auth/permissions.js';
import { download, toCsv, relTime } from '../../../lib/util.js';
import { zip } from '../../../lib/zip.js';
import { addTemplateCatalogue } from '../../../presets/seed.js';
import { Panel, Row } from './general.jsx';
import * as S from '../../../state.js';
import { t } from '../../../i18n/index.js';

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const slug = () => (S.business.value?.name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);

export async function backupJson() {
  const tables = {};
  for (const e of Object.keys(ENTITIES)) tables[e] = await db().table(e).toArray();
  const data = { format: 'pentarch-pos-backup', version: 1, tenant_id: S.tenantId.value, business: S.business.value?.name, exported_at: Date.now(), app: 'Pentarch POS 1.0', tables };
  download(`${slug()}-backup-${stamp()}.json`, JSON.stringify(data), 'application/json');
  await setMeta('last_backup_at', Date.now());
  await audit('backup.download', 'business', S.tenantId.value, { records: Object.values(tables).reduce((s, x) => s + x.length, 0) });
}
const CSV_SETS = {
  products: (r) => ({ name: r.name, sku: r.sku, barcode: r.barcode, type: r.type, unit: r.unit, price: r.price / 100, cost: r.cost / 100, tax: r.tax, active: r.active !== false }),
  sales: (r) => ({ no: r.no, date: new Date(r.created_at).toISOString(), status: r.status, customer_id: r.customer_id || '', subtotal: r.subtotal / 100, discount: r.discount / 100, tax: r.tax_total / 100, total: r.total / 100, paid: r.paid / 100, balance: r.balance / 100, methods: r.payments.map((p) => p.method + ':' + p.amount / 100 + (p.ref ? ':' + p.ref : '')).join(' | ') }),
  sale_lines: null,
  customers: (r) => ({ name: r.name, phone: r.phone, email: r.email, kra_pin: r.kra_pin, group: r.group, credit_limit: r.credit_limit / 100, points: r.loyalty_points }),
  customer_payments: (r) => ({ date: new Date(r.created_at).toISOString(), customer_id: r.customer_id, amount: r.amount / 100, method: r.method, ref: r.ref }),
  stock_moves: (r) => ({ date: new Date(r.created_at).toISOString(), product_id: r.product_id, branch_id: r.branch_id, qty: r.qty, type: r.type, ref: r.ref_id || '', batch: r.batch_no || '', serial: r.serial || '', user_id: r.user_id || '' }),
  shifts: (r) => ({ opened: new Date(r.opened_at).toISOString(), closed: r.closed_at ? new Date(r.closed_at).toISOString() : '', user_id: r.user_id, float: r.opening_float / 100, expected: r.expected_cash / 100, counted: r.counted_cash / 100, variance: r.variance / 100 }),
  returns: (r) => ({ date: new Date(r.created_at).toISOString(), sale: r.sale_no || r.sale_id, total: r.total / 100, reason: r.reason }),
  suppliers: (r) => ({ name: r.name, phone: r.phone, kra_pin: r.kra_pin, contact: r.contact }),
  expenses: (r) => ({ date: r.date, category: r.category, amount: r.amount / 100, method: r.method, payee: r.payee }),
  audit: (r) => ({ at: new Date(r.at).toISOString(), action: r.action, entity: r.entity, entity_id: r.entity_id || '', user_id: r.user_id || '', details: JSON.stringify(r.details || {}) })
};
async function exportZip() {
  const files = [];
  for (const [name, fn] of Object.entries(CSV_SETS)) {
    if (name === 'sale_lines') {
      const sales = await db().sales.toArray();
      const rows = sales.flatMap((s) => s.lines.map((l) => ({ sale: s.no, date: new Date(s.created_at).toISOString(), status: s.status, product_id: l.product_id, name: l.name, qty: l.qty, unit: l.unit, price: l.price / 100, discount: (l.discount || 0) / 100, tax: l.tax, tax_amount: (l.tax_amount || 0) / 100, total: l.total / 100, cost: (l.cost || 0) / 100 })));
      if (rows.length) files.push({ name: 'sale_lines.csv', data: '﻿' + toCsv(rows, Object.keys(rows[0]).map((k) => ({ key: k }))) });
      continue;
    }
    const rows = (await db().table(name).toArray()).filter((r) => !r.deleted).map(fn);
    if (rows.length) files.push({ name: name + '.csv', data: '﻿' + toCsv(rows, Object.keys(rows[0]).map((k) => ({ key: k }))) });
  }
  download(`${slug()}-export-${stamp()}.zip`, zip(files));
  await audit('export.all', 'business', S.tenantId.value, { files: files.length });
}
async function restore(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast.error(t('This is not a Pentarch POS backup file')); }
  if (data?.format !== 'pentarch-pos-backup' || !data.tables) return toast.error(t('This is not a Pentarch POS backup file'));
  const n = Object.values(data.tables).reduce((s, x) => s + x.length, 0);
  const typed = await promptText({ title: t('Restore backup from {d}?', { d: new Date(data.exported_at).toLocaleString('en-KE') }), label: t('This replaces ALL data on this device with {n} records from “{b}”. Type RESTORE to continue.', { n, b: data.business }), placeholder: 'RESTORE', ok: t('Restore') });
  if (typed?.trim().toUpperCase() !== 'RESTORE') return;
  const d = db();
  await d.transaction('rw', [...Object.keys(ENTITIES).map((e) => d.table(e)), d.outbox], async () => {
    for (const e of Object.keys(ENTITIES)) { await d.table(e).clear(); if (data.tables[e]?.length) await d.table(e).bulkPut(data.tables[e]); }
    if (!S.isDemo.value) { await d.outbox.clear(); for (const e of Object.keys(ENTITIES)) if (isSynced(e) && data.tables[e]?.length) await d.outbox.bulkAdd(data.tables[e].map((r) => ({ entity: e, id: r.id, op: 'put', record: r, tries: 0 }))); }
  });
  await rebuildLevels();
  await audit('backup.restore', 'business', S.tenantId.value, { records: n, from: data.exported_at });
  await loadState();
  toast(t('Backup restored'));
}

export default function DataPanel() {
  const [last, setLast] = useState(null);
  const [counts, setCounts] = useState({});
  const [est, setEst] = useState(null);
  useEffect(() => {
    getMeta('last_backup_at').then(setLast);
    Promise.all(['products', 'sales', 'customers', 'stock_moves', 'audit'].map(async (e) => [e, await db().table(e).count()])).then((r) => setCounts(Object.fromEntries(r)));
    navigator.storage?.estimate?.().then(setEst).catch(() => {});
  }, []);
  const owner = can('backup.manage');
  return (
    <div class="col gap-l">
      <Panel title={t('Backup & restore')} sub={t('Your data is always yours. Backup and export work even if the subscription has expired.')}>
        <div class="grid3 mb" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          {Object.entries(counts).map(([k, v]) => <div class="card pad" style={{ background: 'var(--paper)', border: 0 }}><div class="small mute bold">{t({ products: 'Products', sales: 'Sales', customers: 'Customers', stock_moves: 'Stock movements', audit: 'Activity log' }[k])}</div><div class="mono bold" style={{ fontSize: '20px' }}>{v.toLocaleString()}</div></div>)}
        </div>
        <Row title={t('Download full backup (JSON)')} sub={last ? t('Last backup {when}', { when: relTime(last, t) }) : t('No backup downloaded on this device yet')}>{owner && <Btn variant="primary" icon="download" onClick={backupJson}>{t('Download backup')}</Btn>}</Row>
        <Row title={t('Export everything to CSV (Excel)')} sub={t('One zip with products, sales, sale lines, customers, payments, stock and the activity log')}><Btn icon="download" onClick={exportZip}>{t('Export CSV zip')}</Btn></Row>
        {owner && <Row title={t('Restore from a backup file')} sub={t('Replaces the data on this device')}><label class="btn danger"><Icon name="upload" size={18} />{t('Choose backup file')}<input type="file" accept="application/json,.json" class="sr" onChange={(e) => e.target.files[0] && restore(e.target.files[0])} /></label></Row>}
        {est && <div class="small mute mt">{t('Storage used on this device: {u} MB of {q} MB', { u: (est.usage / 1048576).toFixed(1), q: Math.round(est.quota / 1048576).toLocaleString() })}</div>}
      </Panel>
      {owner && (
        <Panel title={t('Sample & template data')}>
          {S.isDemo.value ? (
            <Row title={t('Reset the demo')} sub={t('Start again with fresh sample data')}><Btn icon="refresh" onClick={async () => { if (await confirm({ title: t('Reset the demo?'), ok: t('Reset') })) resetDemo(); }}>{t('Reset demo')}</Btn></Row>
          ) : <>
            <Row title={t('Load the template catalogue for my business type')} sub={t('Adds typical products with prices you can edit. Nothing is deleted.')}><Btn icon="layers" onClick={async () => { const n = await addTemplateCatalogue(S.business.value.type); toast(t('{n} products added', { n })); }}>{t('Add template products')}</Btn></Row>
            <Row title={t('Clear unused template products')} sub={t('Deletes products that have never been sold or stocked')}><Btn variant="danger" icon="trash" onClick={async () => {
              const used = new Set([...(await db().stock_moves.toArray()).map((m) => m.product_id), ...(await db().sales.toArray()).flatMap((s) => s.lines.map((l) => l.product_id))]);
              const unused = (await db().products.toArray()).filter((p) => !p.deleted && !used.has(p.id) && !p.has_variants);
              if (!unused.length) return toast(t('Nothing to clear'));
              if (!(await confirm({ title: t('Delete {n} unused products?', { n: unused.length }), danger: true, ok: t('Delete') }))) return;
              await saveMany('products', unused.map((p) => ({ ...p, deleted: 1, active: false })));
              await audit('product.clear_unused', 'products', null, { count: unused.length });
              toast(t('{n} products removed', { n: unused.length }));
            }}>{t('Clear')}</Btn></Row>
          </>}
        </Panel>
      )}
    </div>
  );
}
