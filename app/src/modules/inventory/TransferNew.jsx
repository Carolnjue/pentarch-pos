// Move stock to another branch: choose branch, scan/add items, send. The receiving branch confirms what arrived.
import { useState } from 'preact/hooks';
import { levels } from '../../db/catalog.js';
import { PageHeader, Btn, Icon, Empty, Select, Input, Badge } from '../../ui/kit.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { previewPrint } from '../../ui/printpreview.jsx';
import { navigate } from '../../router.js';
import { sendTransfer, r3 } from '../../core/inventory.js';
import { transferHtml } from '../../print/stockdocs.js';
import { ProductAdder, QtyIn, useScan, resolveCode, fq, unitOf, branchName, ctxPrint, Done, multiBranch } from './common.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function TransferNew() {
  const others = S.branches.value.filter((b) => b.id !== S.branch.value?.id);
  const [to, setTo] = useState(others[0]?.id || '');
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [flash, setFlash] = useState(null);
  const add = (p, factor = 1) => {
    if (!p.track_stock) return;
    setLines((cur) => (cur.find((l) => l.product_id === p.id) ? cur.map((l) => (l.product_id === p.id ? { ...l, qty: r3(l.qty + factor) } : l)) : [...cur, { product_id: p.id, p, qty: factor }]));
    setFlash(p.id); setTimeout(() => setFlash(null), 700);
  };
  useScan((code) => { const r = resolveCode(code); if (r) add(r.product, r.factor); else toast.error(t('Barcode {c} not found', { c: code })); });
  if (!multiBranch()) return <div class="page"><Empty icon="store" title={t('You have only one branch')} text={t('Add another branch in Settings → Branches & devices to move stock between them.')}><Btn onClick={() => navigate('/settings/branches')}>{t('Branches')}</Btn></Empty></div>;
  const short = lines.filter((l) => l.qty > (levels.value.get(l.product_id) || 0));
  const send = async () => {
    const ok = await confirm({ title: t('Send to {b}?', { b: branchName(to) }), message: tn(lines.length, 'Stock of {n} item leaves this branch now and arrives when {b} receives it.', 'Stock of {n} items leaves this branch now and arrives when {b} receives it.', { b: branchName(to) }), ok: t('Yes, send') });
    if (!ok) return;
    setBusy(true);
    try { const tr = await sendTransfer({ to_branch_id: to, lines: lines.map((l) => ({ product_id: l.product_id, qty: l.qty })), note }); setDone(tr); toast(t('Transfer {no} sent', { no: tr.no })); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  if (done) return (
    <div class="page" style={{ maxWidth: '760px' }}>
      <Done title={t('Stock sent to {b}', { b: branchName(done.to_branch_id) })} text={t('Transfer {no}. Print the transfer note and send it with the goods.', { no: done.no })}>
        <Btn icon="print" onClick={() => previewPrint(transferHtml(done, ctxPrint(), branchName), { title: done.no, paper: 'a4' })}>{t('Print transfer note')}</Btn>
        <Btn icon="eye" onClick={() => navigate('/inventory/transfers/' + done.id)}>{t('View transfer')}</Btn>
        <Btn variant="primary" icon="plus" onClick={() => { setDone(null); setLines([]); setNote(''); }}>{t('Send more')}</Btn>
      </Done>
    </div>
  );
  return (
    <div class="page wide" style={{ maxWidth: '1200px' }}>
      <PageHeader back="#/inventory/transfers" title={t('Move stock to another branch')} sub={t('From {b}', { b: S.branch.value?.name })} />
      <div class="split-360">
        <div class="card">
          <div class="card-h"><h3 class="grow">{t('Items to send')}</h3><span class="scan-hint"><Icon name="barcode" size={16} />{t('Scan items or search')}</span></div>
          <div class="card-b"><ProductAdder autoFocus onPick={(p, r) => add(p, r?.factor || 1)} /></div>
          <div class="le">
            {lines.length > 0 && <div class="le-row t-3 head"><span>{t('Item')}</span><span>{t('Quantity')}</span><span class="right">{t('Here now')}</span><span /></div>}
            {lines.map((l, i) => { const have = levels.value.get(l.product_id) || 0; return (
              <div class={'le-row t-3' + (flash === l.product_id ? ' flash' : '')} key={l.product_id}>
                <div class="nm"><b>{l.p.name}</b><small class="mono">{l.p.barcode || l.p.sku}</small></div>
                <div class="c-qty"><QtyIn value={l.qty} onValue={(v) => setLines(lines.map((x, k) => (k === i ? { ...x, qty: v } : x)))} label={t('Quantity of {name}', { name: l.p.name })} step={l.p.unit === 'kg' ? 0.5 : 1} /></div>
                <div class="right c-here"><span class="small mute hide-d">{t('Here now')}: </span>{l.qty > have ? <Badge tone="bad">{fq(have)}{unitOf(l.p)}</Badge> : <span class="mono mute">{fq(have)}{unitOf(l.p)}</span>}</div>
                <Btn class="rm" variant="ghost" icon="x" size="sm" aria-label={t('Remove')} onClick={() => setLines(lines.filter((_, k) => k !== i))} />
              </div>); })}
            {!lines.length && <Empty icon="truck" title={t('No items yet')} text={t('Scan the items you are sending, or type their names above.')} />}
          </div>
        </div>
        <div class="card pad sum-card sticky-side col">
          <Select label={t('Send to')} value={to} onValue={setTo} options={others.map((b) => ({ value: b.id, label: b.name }))} />
          <Input label={t('Note (optional)')} value={note} onValue={setNote} placeholder={t('e.g. driver name, vehicle')} />
          <div class="kv"><span>{t('Items')}</span><b>{lines.length}</b></div>
          <div class="kv"><span>{t('Total quantity')}</span><b>{fq(lines.reduce((s, l) => s + l.qty, 0))}</b></div>
          {short.length > 0 && <div class="callout warn"><Icon name="alert" size={18} />{tn(short.length, '{n} item has less stock here than you are sending. Stock here will go below zero.', '{n} items have less stock here than you are sending. Stock here will go below zero.')}</div>}
          <Btn variant="primary" size="lg" icon="truck" disabled={!lines.length || !to || busy || lines.some((l) => l.qty <= 0)} onClick={send}>{t('Send stock')}</Btn>
        </div>
      </div>
    </div>
  );
}
