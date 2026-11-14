// One transfer: details, receive at the destination (confirm quantities, record any shortage), cancel, print.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { catalog } from '../../db/catalog.js';
import { PageHeader, Btn, Icon, Empty, Badge, Input } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { confirm, toast, promptText } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { on } from '../../lib/bus.js';
import { can } from '../../auth/permissions.js';
import { receiveTransfer, cancelTransfer, r3 } from '../../core/inventory.js';
import { transferHtml } from '../../print/stockdocs.js';
import { QtyIn, StatusPill, fq, unitOf, dtm, branchName, userName, ctxPrint } from './common.jsx';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function TransferView({ params }) {
  const [tr, setTr] = useState(null);
  const [got, setGot] = useState({});
  const [note, setNote] = useState('');
  const [behalf, setBehalf] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = async () => { const r = await db().transfers.get(params.id); setTr(r && !r.deleted ? r : false); if (r) setGot(Object.fromEntries(r.lines.map((l) => [l.product_id, l.received ?? l.qty]))); };
  useEffect(() => { load(); return on('change', (e) => e === 'transfers' && load()); }, [params.id]);
  if (tr === false) return <div class="page"><Empty icon="truck" title={t('Transfer not found')} /></div>;
  if (!tr) return <div class="page" />;
  const me = S.branch.value?.id;
  const canReceive = tr.status === 'sent' && (me === tr.to_branch_id || behalf);
  const diffs = tr.lines.filter((l) => r3((got[l.product_id] ?? l.qty) - l.qty) !== 0);
  const print = () => previewPrint(transferHtml(tr, ctxPrint(), branchName), { title: tr.no, paper: 'a4' });
  const receive = async () => {
    const msg = diffs.length ? t('{n} items are different from what was sent. The difference will be recorded as lost in transit (or extra).', { n: diffs.length }) : t('Everything arrived as sent.');
    if (!(await confirm({ title: t('Confirm what arrived?'), message: msg, ok: t('Yes, receive') }))) return;
    setBusy(true);
    try { await receiveTransfer(tr, got, note); toast(t('Stock received into {b}', { b: branchName(tr.to_branch_id) })); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const cancel = async () => {
    const why = await promptText({ title: t('Cancel this transfer?'), label: t('Reason'), placeholder: t('e.g. sent by mistake'), ok: t('Cancel transfer'), required: true });
    if (why == null) return;
    await cancelTransfer(tr, why);
    toast(t('Transfer cancelled — stock is back in {b}', { b: branchName(tr.from_branch_id) }));
  };
  return (
    <div class="page" style={{ maxWidth: '1100px' }}>
      <PageHeader back="#/inventory/transfers" title={<span class="row wrap gap-s">{t('Transfer')} <span class="mono">{tr.no}</span><StatusPill s={tr.status === 'sent' ? 'transit' : tr.status} />{tr.discrepancy && <Badge tone="bad">{t('Difference')}</Badge>}</span>}
        sub={<span class="row wrap gap-s">{branchName(tr.from_branch_id)} <Icon name="arrow-right" size={14} /> {branchName(tr.to_branch_id)} · {t('sent {d} by {u}', { d: dtm(tr.sent_at || tr.created_at), u: userName(tr.sent_by).split(' ')[0] || '—' })}</span>}
        actions={<>
          <Btn icon="print" onClick={print}>{t('Print transfer note')}</Btn>
          {tr.status === 'sent' && me === tr.from_branch_id && can('inventory.transfer') && <Btn variant="ghost" icon="x" onClick={cancel}>{t('Cancel transfer')}</Btn>}
        </>} />
      {tr.status === 'sent' && !canReceive && (
        <div class="callout mb"><Icon name="info" size={18} /><span class="grow">{t('On the way. {b} confirms the quantities when the goods arrive.', { b: branchName(tr.to_branch_id) })}</span>
          {can('branches.switch') && <Btn size="sm" onClick={() => setBehalf(true)}>{t('Receive for {b}', { b: branchName(tr.to_branch_id) })}</Btn>}</div>
      )}
      {canReceive && <div class="callout ok mb"><Icon name="truck" size={18} /><span>{t('Count what arrived. If something is missing or damaged, change the quantity — the difference is recorded.')}</span></div>}
      <div class="card mb">
        <Table rows={tr.lines} columns={[
          { key: 'name', label: t('Item'), render: (l) => <div><b>{l.name}</b>{l.batches?.filter((b) => b.batch_no).length > 0 && <div class="small mute mono">{l.batches.filter((b) => b.batch_no).map((b) => `${b.batch_no} (${fq(b.qty)})`).join(', ')}</div>}{l.serials?.length > 0 && <div class="small mute mono">{l.serials.join(', ')}</div>}</div> },
          { key: 'qty', label: t('Qty sent'), num: true, render: (l) => fq(l.qty) + unitOf(catalog.value.byId.get(l.product_id)) },
          { key: 'got', label: t('Qty received'), num: !canReceive, width: canReceive ? '170px' : undefined, render: (l) => canReceive
            ? <QtyIn value={got[l.product_id] ?? l.qty} onValue={(v) => setGot({ ...got, [l.product_id]: v })} label={t('Received quantity of {name}', { name: l.name })} />
            : tr.status === 'received' ? <span class="row gap-s" style={{ justifyContent: 'flex-end' }}>{fq(l.received)}{r3(l.received - l.qty) !== 0 && <Badge tone="bad">{l.received < l.qty ? '−' : '+'}{fq(Math.abs(l.received - l.qty))}</Badge>}</span> : <span class="mute">—</span> }
        ]} />
      </div>
      {canReceive && (
        <div class="card pad row wrap" style={{ alignItems: 'flex-end' }}>
          <Input class="grow" label={t('Note (optional)')} value={note} onValue={setNote} placeholder={t('e.g. 2 packets torn')} />
          <Btn variant="primary" size="lg" icon="check" disabled={busy} onClick={receive}>{diffs.length ? t('Receive with {n} differences', { n: diffs.length }) : t('Receive all')}</Btn>
        </div>
      )}
      {tr.status === 'received' && <div class={'callout ' + (tr.discrepancy ? 'bad' : 'ok')}><Icon name={tr.discrepancy ? 'alert' : 'check-circle'} size={18} /><span>{t('Received {d} by {u}.', { d: dtm(tr.received_at), u: userName(tr.received_by) || '—' })} {tr.short > 0 && t('{n} short (lost in transit).', { n: fq(tr.short) })} {tr.over > 0 && t('{n} extra.', { n: fq(tr.over) })} {tr.receive_note}</span></div>}
      {tr.status === 'cancelled' && <div class="callout warn"><Icon name="undo" size={18} /><span>{t('Cancelled: {r}', { r: tr.cancel_reason || '' })}</span></div>}
      {tr.note && <p class="small mute mt">{t('Note')}: {tr.note}</p>}
    </div>
  );
}
