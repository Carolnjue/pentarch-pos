// One delivery (GRN) or supplier return: lines, batches, serials, costs, payments; print, labels, return.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Empty, Badge, Icon } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { money, kes } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { supplierAcc } from '../../core/purchasing.js';
import { grnHtml } from '../../print/stockdocs.js';
import { fq, dtm, userName, ctxPrint, branchName, multiBranch } from '../inventory/common.jsx';
import { t } from '../../i18n/index.js';

export default function GrnView({ params }) {
  const [g, setG] = useState(null);
  const [sup, setSup] = useState(null);
  const [po, setPo] = useState(null);
  const [due, setDue] = useState(0);
  useEffect(() => {
    (async () => {
      const x = await db().goods_received.get(params.id);
      if (!x || x.deleted) return setG(false);
      setG(x);
      if (x.supplier_id) { setSup(await db().suppliers.get(x.supplier_id)); const acc = await supplierAcc(x.supplier_id); setDue(acc.open.find((o) => o.grn.id === x.id)?.due || 0); }
      if (x.po_id) setPo(await db().purchase_orders.get(x.po_id));
    })();
  }, [params.id]);
  if (g === false) return <div class="page"><Empty icon="truck" title={t('Delivery not found')} /></div>;
  if (!g) return <div class="page" />;
  const ret = g.kind === 'return';
  const costs = can('products.cost_view') || can('purchasing.receive');
  const print = () => previewPrint(grnHtml(g, sup, ctxPrint(), userName(g.user_id)), { title: g.no, paper: 'a4' });
  return (
    <div class="page" style={{ maxWidth: '1150px' }}>
      <PageHeader back={ret ? '#/purchasing/returns' : '#/purchasing'} title={<span class="row wrap gap-s">{ret ? t('Return') : t('Delivery@@goods')} <span class="mono">{g.no}</span>{!ret && g.supplier_id && (due <= 0 ? <Badge tone="ok">{t('Paid')}</Badge> : <Badge tone="bad">{t('{v} due', { v: kes(due) })}</Badge>)}</span>}
        sub={[sup ? sup.name : t('No supplier'), dtm(g.created_at), (ret ? t('returned by {u}', { u: userName(g.user_id) }) : t('received by {u}', { u: userName(g.user_id) })), multiBranch() && branchName(g.branch_id)].filter(Boolean).join(' · ')}
        actions={<>
          <Btn icon="print" onClick={print}>{ret ? t('Print return note') : t('Print delivery note')}</Btn>
          {!ret && can('labels.print') && <Btn icon="barcode" onClick={() => navigate('/products/labels?ids=' + g.lines.map((l) => l.product_id).join(',') + '&qty=' + g.lines.map((l) => Math.max(1, Math.ceil(l.qty))).join(',') + '&exp=' + g.lines.map((l) => l.expiry || '').join(','))}>{t('Print labels')}</Btn>}
          {!ret && g.supplier_id && can('purchasing.returns') && <Btn icon="undo" onClick={() => navigate('/purchasing/returns/new?grn=' + g.id)}>{t('Return items')}</Btn>}
          {!ret && due > 0 && can('purchasing.pay') && <Btn variant="primary" icon="wallet" onClick={() => navigate('/purchasing/payments?new=1&supplier=' + g.supplier_id + '&grn=' + g.id)}>{t('Pay {v}', { v: money(due) })}</Btn>}
        </>} />
      <div class="card mb">
        <div class="card-b kpis-mini">
          {sup && <div><small>{t('Supplier')}</small><a href={'#/purchasing/suppliers/' + sup.id} style={{ fontWeight: 700 }}>{sup.name}</a></div>}
          {g.supplier_invoice_no && <div><small>{t('Supplier invoice no.')}</small><b>{g.supplier_invoice_no}</b></div>}
          {po && <div><small>{t('Purchase order')}</small><a class="mono" href={'#/purchasing/orders/' + po.id}>{po.no}</a></div>}
          {ret && g.reason && <div><small>{t('Reason')}</small><b style={{ fontFamily: 'var(--f-body)', fontSize: '15px' }}>{g.reason}</b></div>}
          <div><small>{ret ? t('Credit (return)') : t('Total')}</small><b>{money(Math.abs(g.total))}</b></div>
          {!ret && <div><small>{t('Paid on delivery')}</small><b>{money(g.paid || 0)}</b></div>}
        </div>
      </div>
      <div class="card mb">
        <Table rows={g.lines} columns={[
          { key: 'name', label: t('Item'), render: (l) => <div><a href={'#/inventory/product/' + l.product_id} style={{ fontWeight: 700, color: 'inherit' }}>{l.name}</a>
            {l.pack && <div class="small mute">{fq(l.pack.qty)} × {l.pack.name} ({t('{n} each', { n: l.pack.factor })})</div>}
            {l.batch_no && <div class="small mute mono">{t('Batch')} {l.batch_no}{l.expiry ? ' · ' + t('exp') + ' ' + l.expiry : ''}</div>}
            {l.serials?.length > 0 && <div class="small mute mono">{l.serials.join(', ')}</div>}</div> },
          { key: 'qty', label: t('Qty'), num: true, render: (l) => fq(Math.abs(l.qty)) },
          ...(costs ? [{ key: 'cost', label: t('Cost each'), num: true, render: (l) => kes(l.cost) },
            ...(!ret && (g.extra_costs || []).length ? [{ key: 'unit_cost', label: t('With extra costs'), num: true, hideMobile: true, render: (l) => kes(l.unit_cost) }] : []),
            { key: 'amt', label: t('Amount'), num: true, render: (l) => <b>{kes(Math.round(Math.abs(l.qty) * l.cost))}</b> }] : [])
        ]} />
        {costs && (g.extra_costs || []).length > 0 && <div class="card-b" style={{ borderTop: '1px solid var(--line)' }}>{g.extra_costs.map((x) => <div class="row small"><span class="grow mute">{x.label || t('Extra cost')}</span><b class="mono">{kes(x.amount)}</b></div>)}</div>}
      </div>
      {g.note && <div class="callout"><Icon name="note" size={18} />{g.note}</div>}
    </div>
  );
}
