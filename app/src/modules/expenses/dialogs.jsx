// Record-expense dialog and categories manager.
import { useEffect, useState } from 'preact/hooks';
import { openModal, Modal, toast, promptText, confirm } from '../../ui/overlay.jsx';
import { Btn, MoneyInput, Input, Icon, Seg, Switch, Field } from '../../ui/kit.jsx';
import { money } from '../../lib/money.js';
import { dayKey, isMpesaCode } from '../../lib/util.js';
import { requirePerm } from '../../auth/override.jsx';
import { can } from '../../auth/permissions.js';
import { recordExpense, recentPayees, addCategory, hideCategory } from './api.js';
import { allCats, customCats, expenseCatLabel } from './cats.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export async function recordExpenseDialog(preset = {}) {
  const by = await requirePerm('expenses.record', t('Record an expense'));
  if (!by) return null;
  return openModal((close) => <RecordExpense close={close} preset={preset} />);
}

const METHODS = () => [{ value: 'cash', label: t('Cash'), icon: 'cash' }, { value: 'mpesa', label: 'M-Pesa', icon: 'phone' }, { value: 'bank', label: t('Bank'), icon: 'bank' }, { value: 'card', label: t('Card'), icon: 'card' }];

function RecordExpense({ close, preset }) {
  const sh = S.shift.value;
  const [amt, setAmt] = useState(preset.amount || 0);
  const [cat, setCat] = useState(preset.category || '');
  const [method, setMethod] = useState(preset.method || 'cash');
  const [drawer, setDrawer] = useState(!!sh);
  const [payee, setPayee] = useState('');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(dayKey(Date.now()));
  const [note, setNote] = useState('');
  const [payees, setPayees] = useState([]);
  const [cats, setCats] = useState(allCats());
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { recentPayees().then(setPayees); }, []);
  const today = dayKey(Date.now());
  const fromTill = method === 'cash' && !!sh && drawer && date === today;
  const go = async () => {
    const e = {};
    if (!(amt > 0)) e.amt = t('Enter how much you paid');
    if (!cat) e.cat = t('Choose what the money was for');
    if (method === 'mpesa' && ref && !isMpesaCode(ref.toUpperCase())) e.ref = t('M-Pesa codes have 10 letters and numbers, e.g. RKT4H7XQ2P');
    setErr(e);
    if (Object.keys(e).length || busy) return;
    setBusy(true);
    try {
      const rec = await recordExpense({ amount: amt, category: cat, method, fromDrawer: fromTill, payee, ref: method === 'mpesa' ? ref.toUpperCase() : ref, note, date });
      toast(t('{c}: {a} recorded', { c: expenseCatLabel(cat), a: money(amt) }) + (rec.shift_id ? ' · ' + t('taken from the till') : ''));
      close(rec);
    } catch (x) { toast.error(x.message); setBusy(false); }
  };
  const newCat = async () => {
    const n = await promptText({ title: t('New expense category'), label: t('Name'), placeholder: t('e.g. Security, Cleaning, Licences'), required: true, ok: t('Add') });
    if (!n) return;
    const c = await addCategory(n);
    if (c) { setCats(allCats()); setCat(c.id); }
  };
  const pickPayee = (p) => { setPayee(p.payee); if (!cat) setCat(p.category); };
  return (
    <Modal title={t('Record an expense')} icon="wallet" size="lg" onClose={() => close(null)}
      footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><span class="spacer" /><Btn variant="primary" icon="check" onClick={go} disabled={busy}>{t('Save expense')}</Btn></>}>
      <form class="col exp-form" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <MoneyInput label={t('How much?')} value={amt} onValue={(v) => { setAmt(v); setErr({ ...err, amt: null }); }} big error={err.amt} data-autofocus autoFocus />
        <Field label={t('What was it for?')} error={err.cat}>
          <div class="exp-cats" role="radiogroup" aria-label={t('Category')}>
            {cats.map((c) => <button type="button" role="radio" aria-checked={cat === c.id} class={'exp-cat' + (cat === c.id ? ' on' : '')} onClick={() => { setCat(c.id); setErr({ ...err, cat: null }); }}><Icon name={c.icon} size={20} /><span>{c.name}</span></button>)}
            {can('expenses.categories') && <button type="button" class="exp-cat add" onClick={newCat}><Icon name="plus" size={20} /><span>{t('New category')}</span></button>}
          </div>
        </Field>
        <Field label={t('Paid with')}><Seg value={method} onValue={setMethod} options={METHODS()} /></Field>
        {method === 'cash' && (sh ? (
          <div class="exp-till"><Switch checked={drawer} onChange={setDrawer} label={t('Taken from the till (cash drawer)')} sub={date !== today ? t('Only today\'s expenses can come from the open shift.') : drawer ? t('The shift\'s expected cash goes down by this amount, so the count at closing still balances.') : t('Paid from other money (for example the owner\'s pocket or the safe).')} disabled={date !== today} /></div>
        ) : <p class="small mute" style={{ margin: 0 }}><Icon name="info" size={14} /> {t('No shift is open, so the till is not affected.')}</p>)}
        <div class="form-grid">
          <Input label={t('Paid to')} value={payee} onValue={setPayee} placeholder={t('e.g. Landlord, Kenya Power, Boda rider')} list="exp-payees" autocomplete="off" />
          <Input label={method === 'mpesa' ? t('M-Pesa code') : t('Receipt or reference no.')} value={ref} onValue={(v) => { setRef(v); setErr({ ...err, ref: null }); }} error={err.ref} inputClass={method === 'mpesa' ? 'mono' : ''} />
          <Input label={t('Date')} type="date" value={date} max={today} onValue={(v) => setDate(v || today)} />
          <Input label={t('Note (optional)')} value={note} onValue={setNote} />
        </div>
        <datalist id="exp-payees">{payees.map((p) => <option value={p.payee} />)}</datalist>
        {payees.length > 0 && !payee && <div class="row wrap gap-s"><span class="small mute">{t('Recent:')}</span>{payees.slice(0, 6).map((p) => <button type="button" class="chip" onClick={() => pickPayee(p)}>{p.payee}</button>)}</div>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function categoriesDialog() {
  return openModal((close) => <Categories close={close} />);
}
function Categories({ close }) {
  const [list, setList] = useState(customCats().filter((c) => !c.hidden));
  const add = async () => {
    const n = await promptText({ title: t('New expense category'), label: t('Name'), placeholder: t('e.g. Security, Cleaning, Licences'), required: true, ok: t('Add') });
    if (n) { await addCategory(n); setList(customCats().filter((c) => !c.hidden)); }
  };
  const hide = async (c) => {
    if (!(await confirm({ title: t('Remove “{c}”?', { c: c.name }), message: t('Expenses already recorded keep this category. It will no longer be offered for new expenses.'), ok: t('Remove'), danger: true }))) return;
    await hideCategory(c.id); setList(customCats().filter((x) => !x.hidden));
  };
  return (
    <Modal title={t('Expense categories')} icon="tags" size="sm" onClose={() => close()} footer={<><Btn icon="plus" onClick={add}>{t('New category')}</Btn><span class="spacer" /><Btn variant="primary" onClick={() => close()}>{t('Done')}</Btn></>}>
      <p class="small mute" style={{ marginTop: 0 }}>{t('Built-in categories are always available. Add your own for anything else you pay for regularly.')}</p>
      <div class="card">
        {allCats().filter((c) => !c.custom).map((c) => <div class="list-item"><Icon name={c.icon} size={18} /><span class="grow">{c.name}</span><span class="small mute">{t('Built-in')}</span></div>)}
        {list.map((c) => <div class="list-item"><Icon name="tag" size={18} /><span class="grow"><b>{c.name}</b></span><Btn size="xs" variant="ghost" icon="trash" aria-label={t('Remove')} onClick={() => hide(c)} /></div>)}
      </div>
    </Modal>
  );
}
