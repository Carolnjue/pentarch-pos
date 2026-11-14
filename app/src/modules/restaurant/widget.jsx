// Home dashboard strip: tables occupied, open bills value, takeaway/delivery queue, kitchen tickets waiting.
import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../../ui/kit.jsx';
import { db } from '../../db/index.js';
import { on } from '../../lib/bus.js';
import { money } from '../../lib/money.js';
import { t } from '../../i18n/index.js';
import { loadTables, openOrders, orderCalc, here } from './logic.js';

export function TablesWidget() {
  const [f, setF] = useState(null);
  const load = async () => {
    const [tables, orders, tks] = await Promise.all([loadTables(), openOrders(), db().kitchen_tickets.where('status').equals('new').toArray()]);
    const dine = orders.filter((o) => o.kind === 'table');
    setF({ tables: tables.length, busy: new Set(dine.map((o) => o.table_id)).size, value: orders.reduce((s, o) => s + orderCalc(o).total, 0), queue: orders.length - dine.length, kitchen: tks.filter(here).length });
  };
  useEffect(() => { load(); return on('change', (e) => ['orders', 'tables', 'kitchen_tickets'].includes(e) && load()); }, []);
  if (!f) return <div class="card" style={{ minHeight: '84px' }} />;
  const cell = (href, icon, k, v, sub) => <a class="rw-cell" href={href}><span class="rw-i"><Icon name={icon} size={18} /></span><span class="grow"><span class="rw-k">{k}</span><b class="rw-v mono">{v}</b>{sub && <span class="small mute">{sub}</span>}</span></a>;
  return (
    <div class="card rw">
      {cell('#/tables', 'utensils', t('Tables occupied'), `${f.busy} / ${f.tables}`)}
      {cell('#/tables', 'receipt', t('Open bills'), money(f.value))}
      {cell('#/orders', 'bag', t('Takeaway & delivery'), f.queue)}
      {cell('#/kds', 'monitor', t('Kitchen tickets waiting'), f.kitchen)}
    </div>
  );
}
