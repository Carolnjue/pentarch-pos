// Repack / convert: e.g. open one 50 kg bag of sugar and pack 50 × 1 kg packets. Cost carries over to the new packets.
import { useEffect, useState } from 'preact/hooks';
import { catalog, levels } from '../../db/catalog.js';
import { PageHeader, Btn, Icon, Empty } from '../../ui/kit.jsx';
import { confirm, toast } from '../../ui/overlay.jsx';
import { money } from '../../lib/money.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { repack, r3 } from '../../core/inventory.js';
import { repackCost } from '../../core/stockmath.js';
import { ProductAdder, QtyIn, fq, unitOf, Done } from './common.jsx';
import { t } from '../../i18n/index.js';

/** Guess how many "to" units one "from" unit makes from sizes in the names (50kg → 1kg = 50). */
export function guessYield(a, b) {
  const size = (p) => { const m = /(\d+(?:\.\d+)?)\s*(kg|g|l|ml|ltr|litre)s?\b/i.exec(p.name); if (!m) return null; const v = parseFloat(m[1]); const u = m[2].toLowerCase(); return u === 'g' || u === 'ml' ? v / 1000 : v; };
  const x = size(a), y = size(b);
  if (x && y && x > y) return r3(x / y);
  if (x && b.unit === 'kg') return x;
  return 1;
}

function Pick({ label, p, onPick, onClear, exclude }) {
  return (
    <div class="card pad col">
      <div class="lbl">{label}</div>
      {p ? (
        <div class="row">
          <div class="grow"><b style={{ fontSize: '16px' }}>{p.name}</b><div class="small mute">{t('In stock')}: <b class="mono">{fq(levels.value.get(p.id) || 0)}{unitOf(p)}</b></div></div>
          <Btn size="sm" variant="ghost" onClick={onClear}>{t('Change')}</Btn>
        </div>
      ) : <ProductAdder onPick={onPick} filter={(x) => x.track_stock && x.id !== exclude} placeholder={t('Scan or type the item')} />}
    </div>
  );
}

export default function Repack({ query }) {
  const [a, setA] = useState(query?.from ? catalog.value.byId.get(query.from) : null);
  const [b, setB] = useState(null);
  const [aq, setAq] = useState(1);
  const [bq, setBq] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  useEffect(() => { if (a?.repack?.to_id && !b) { const x = catalog.value.byId.get(a.repack.to_id); if (x) setB(x); } }, [a?.id]);
  useEffect(() => { if (a && b) setBq(r3((a.repack?.to_id === b.id ? a.repack.yield : guessYield(a, b)) * aq)); }, [a?.id, b?.id]);
  const unit = a && b ? repackCost(a.cost || 0, aq, bq) : 0;
  const costs = can('products.cost_view');
  const go = async () => {
    if (!(await confirm({ title: t('Repack now?'), message: t('{a} of {x} will be turned into {b} of {y}.', { a: fq(aq) + unitOf(a), x: a.name, b: fq(bq) + unitOf(b), y: b.name }), ok: t('Yes, repack') }))) return;
    setBusy(true);
    try { await repack({ from_id: a.id, from_qty: aq, to_id: b.id, to_qty: bq }); setDone({ a, b, aq, bq }); toast(t('Repacked')); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  if (done) return (
    <div class="page" style={{ maxWidth: '760px' }}>
      <Done title={t('Repacked')} text={t('{a} of {x} → {b} of {y}', { a: fq(done.aq), x: done.a.name, b: fq(done.bq), y: done.b.name })}>
        {can('labels.print') && <Btn icon="barcode" onClick={() => navigate('/products/labels?ids=' + done.b.id + '&qty=' + Math.ceil(done.bq))}>{t('Print labels')}</Btn>}
        <Btn icon="layers" onClick={() => navigate('/inventory')}>{t('Go to stock')}</Btn>
        <Btn variant="primary" icon="refresh" onClick={() => { setDone(null); setAq(1); }}>{t('Repack more')}</Btn>
      </Done>
    </div>
  );
  return (
    <div class="page" style={{ maxWidth: '900px' }}>
      <PageHeader back="#/inventory" title={t('Repack stock')} sub={t('Break bulk into smaller packs, e.g. one 50 kg bag into 50 packets of 1 kg. The cost moves to the new packets.')} />
      <div class="col gap-l">
        <Pick label={t('1. What are you opening?')} p={a} onPick={setA} onClear={() => { setA(null); setB(null); }} exclude={b?.id} />
        {a && <div class="card pad row wrap"><span class="grow bold">{t('How many {u} are you opening?', { u: a.unit === 'pc' ? t('pieces') : a.unit })}</span><QtyIn value={aq} onValue={(v) => { setAq(v); if (b) setBq(r3((bq / (aq || 1)) * v)); }} label={t('Quantity opened')} /></div>}
        {a && <div class="center mute"><Icon name="arrow-left" size={22} style={{ transform: 'rotate(-90deg)', display: 'inline-block' }} /></div>}
        {a && <Pick label={t('2. What are you packing it into?')} p={b} onPick={setB} onClear={() => setB(null)} exclude={a.id} />}
        {a && b && <div class="card pad row wrap"><span class="grow bold">{t('How many {u} did you get?', { u: b.unit === 'pc' ? t('pieces') : b.unit })}</span><QtyIn value={bq} onValue={setBq} label={t('Quantity packed')} /></div>}
        {a && b && (
          <div class="callout ok">
            <Icon name="scale" size={18} />
            <div class="grow">
              <div>{t('{x}: {a} → {b}', { x: a.name, a: fq(levels.value.get(a.id) || 0), b: fq(r3((levels.value.get(a.id) || 0) - aq)) })}</div>
              <div>{t('{x}: {a} → {b}', { x: b.name, a: fq(levels.value.get(b.id) || 0), b: fq(r3((levels.value.get(b.id) || 0) + bq)) })}</div>
              {costs && <div class="bold" style={{ marginTop: '4px' }}>{t('Cost of each {name}: {c}', { name: b.name, c: money(unit) })}{b.price ? ' · ' + t('selling at {p}', { p: money(b.price) }) : ''}</div>}
            </div>
          </div>
        )}
        {!a && <Empty icon="scale" title={t('Choose the item you are opening')} text={t('Scan the bag, carton or crate you are breaking up.')} />}
        <div class="row" style={{ justifyContent: 'flex-end' }}><Btn variant="primary" size="lg" icon="check" disabled={!a || !b || aq <= 0 || bq <= 0 || busy} onClick={go}>{t('Repack')}</Btn></div>
      </div>
    </div>
  );
}
