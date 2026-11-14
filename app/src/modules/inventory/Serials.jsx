// Serial / IMEI lookup: scan or type a number → item, status, where it came from, who bought it, full history.
import { useEffect, useRef, useState } from 'preact/hooks';
import { PageHeader, Btn, Icon, Empty, Badge } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { findSerial } from '../../core/inventory.js';
import { db } from '../../db/index.js';
import { StockTabs, useScan, dtm, d8, userName, moveLabel, branchName, multiBranch } from './common.jsx';
import { t } from '../../i18n/index.js';

const STATUS = { in_stock: ['ok', 'In stock'], sold: ['navy', 'Sold'], returned: ['warn', 'Returned to supplier'], written_off: ['bad', 'Written off'], in_transit: ['warn', 'On the way'], lost: ['bad', 'Lost'] };

export default function Serials({ query }) {
  const [q, setQ] = useState(query?.q || '');
  const [res, setRes] = useState(null);
  const [cust, setCust] = useState(new Map());
  const ref = useRef();
  const run = async (v = q) => {
    const r = await findSerial(v);
    setRes(r);
    const ids = r.map((x) => x.sale?.customer_id).filter(Boolean);
    if (ids.length) setCust(new Map((await db().customers.bulkGet(ids)).filter(Boolean).map((c) => [c.id, c])));
  };
  useEffect(() => { if (query?.q) run(query.q); }, [query?.q]);
  useScan((code) => { setQ(code); run(code); });
  return (
    <div class="page" style={{ maxWidth: '1100px' }}>
      <PageHeader title={t('Stock')} sub={t('Find any phone, laptop or appliance by its serial or IMEI number')} />
      <StockTabs active="/inventory/serials" />
      <form class="row wrap mb" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <div class="input-wrap" style={{ flex: 1, minWidth: '240px' }}><Icon name="hash" size={18} />
          <input ref={ref} class="input mono" value={q} autoFocus placeholder={t('Scan or type a serial / IMEI number')} aria-label={t('Serial / IMEI number')} onInput={(e) => setQ(e.target.value)} data-scan="own" /></div>
        <Btn variant="primary" icon="search" type="submit" disabled={q.trim().length < 3}>{t('Find')}</Btn>
      </form>
      {res && !res.length && <div class="card"><Empty icon="search" title={t('No item with this number')} text={t('Check the number (IMEI numbers have 15 digits) or scan it again.')} /></div>}
      {!res && <div class="card"><Empty icon="hash" title={t('Scan a serial or IMEI number')} text={t('You will see the item, whether it is in stock or sold, which supplier delivered it and which customer bought it.')} /></div>}
      {(res || []).map((x) => {
        const [tone, label] = STATUS[x.rec?.status] || ['', x.rec?.status || '—'];
        const c = x.sale?.customer_id && cust.get(x.sale.customer_id);
        return (
          <div class="card mb">
            <div class="card-h"><div class="grow"><h3 class="mono">{x.serial}</h3><div class="small mute">{x.product?.name || t('Unknown item')}</div></div><Badge tone={tone}>{t(label)}</Badge></div>
            <div class="card-b">
              <div class="kpis-mini mb">
                {multiBranch() && x.rec?.branch_id && <div><small>{t('Branch')}</small><b style={{ fontFamily: 'var(--f-body)', fontSize: '15px' }}>{branchName(x.rec.branch_id)}</b></div>}
                {x.grn && <div><small>{t('Delivered@@goods')}</small><a href={'#/purchasing/grn/' + x.grn.id} class="mono">{x.grn.no}</a><div class="small mute">{d8(x.grn.created_at)}</div></div>}
                {x.sale && <div><small>{t('Sold')}</small><a href={'#/sales/' + x.sale.id} class="mono">{x.sale.no}</a><div class="small mute">{d8(x.sale.created_at)}</div></div>}
                {c && <div><small>{t('Customer')}</small><a href={'#/customers/' + c.id}>{c.name}</a><div class="small mute">{c.phone}</div></div>}
                {x.sale && <div><small>{t('Warranty from')}</small><b style={{ fontFamily: 'var(--f-body)', fontSize: '15px' }}>{d8(x.sale.created_at)}</b></div>}
              </div>
              {x.moves.length > 0 && <Table dense rows={x.moves} columns={[
                { key: 'created_at', label: t('When'), render: (m) => dtm(m.created_at) },
                { key: 'type', label: t('What happened'), render: (m) => moveLabel(m.type) },
                ...(multiBranch() ? [{ key: 'b', label: t('Branch'), hideMobile: true, render: (m) => branchName(m.branch_id) }] : []),
                { key: 'user', label: t('By'), hideMobile: true, render: (m) => userName(m.user_id).split(' ')[0] || '—' },
                { key: 'qty', label: t('Change'), num: true, render: (m) => <span class={m.qty > 0 ? 'ledger-in' : 'ledger-out'}>{m.qty > 0 ? '+1' : '−1'}</span> }
              ]} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
