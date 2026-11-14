import { useEffect, useState } from 'preact/hooks';
import { db } from '../../db/index.js';
import { PageHeader, Btn, Icon, Badge, Empty, Stat } from '../../ui/kit.jsx';
import { Table } from '../../ui/table.jsx';
import { money, kes } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { shiftSummary } from '../../core/shifts.js';
import { can } from '../../auth/permissions.js';
import { openShiftDialog, cashMoveDialog, closeShiftDialog, xReport } from './dialogs.jsx';
import { methodLabel, dt } from '../../print/templates.js';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

export default function ShiftsPage() {
  const sh = S.shift.value;
  const [sum, setSum] = useState(null);
  const [hist, setHist] = useState([]);
  const load = async () => {
    if (S.shift.value) setSum(await shiftSummary(S.shift.value)); else setSum(null);
    const all = await db().shifts.orderBy('opened_at').reverse().limit(60).toArray();
    setHist(all.filter((s) => !s.deleted && s.status === 'closed' && (!s.branch_id || s.branch_id === S.branch.value?.id) && (can('shift.view_all') || s.user_id === S.user.value?.id)));
  };
  useEffect(() => { load(); return on('change', (e) => ['sales', 'shifts', 'cash_moves', 'returns', 'customer_payments'].includes(e) && load()); }, [sh?.id]);
  const users = S.users.value;
  return (
    <div class="page">
      <PageHeader title={t('Cash & shifts')} sub={t('Open and close the till, record cash in and out, print X and Z reports.')}
        actions={sh ? <>
          {can('shift.cash_moves') && <><Btn icon="download" onClick={() => cashMoveDialog('pay_in')}>{t('Pay in')}</Btn><Btn icon="upload" onClick={() => cashMoveDialog('pay_out')}>{t('Pay out')}</Btn><Btn icon="bank" onClick={() => cashMoveDialog('drop')}>{t('Cash drop')}</Btn></>}
          <Btn icon="print" onClick={() => xReport()}>{t('X report')}</Btn>
          <Btn variant="primary" icon="lock" onClick={closeShiftDialog}>{t('Close shift')}</Btn>
        </> : <Btn variant="ok" icon="play" onClick={openShiftDialog}>{t('Open shift')}</Btn>} />
      {!sh ? (
        <div class="card mb"><Empty icon="clock" title={t('No shift is open on this till')} text={S.settings.value.require_shift ? t('Selling requires an open shift. Count your float and open a shift to start.') : t('Shifts are optional. Open one to track cash, get X/Z reports and catch shortages.')}><Btn variant="ok" icon="play" onClick={openShiftDialog}>{t('Open shift')}</Btn></Empty></div>
      ) : sum && (
        <>
          <div class="grid3 mb" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <Stat label={t('Sales this shift')} value={money(sum.gross)} icon="receipt"><div class="small mute" style={{ marginTop: '4px' }}>{tn(sum.sales, '{n} sale', '{n} sales')}</div></Stat>
            <Stat label={t('Expected cash in drawer')} value={money(sum.expected)} icon="cash" />
            <Stat label={t('M-Pesa')} value={money(sum.byMethod.mpesa || 0)} icon="phone" />
            <Stat label={t('Opened')} value={new Date(sh.opened_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} icon="clock"><div class="small mute" style={{ marginTop: '4px' }}>{users.find((u) => u.id === sh.user_id)?.name} · {t('float')} {kes(sh.opening_float)}</div></Stat>
          </div>
          <div class="grid2 mb" style={{ alignItems: 'start' }}>
            <div class="card">
              <div class="card-h"><h3>{t('Takings by method')}</h3></div>
              {Object.entries(sum.byMethod).map(([m, v]) => <div class="list-item"><span class="grow">{methodLabel(m)}</span><b class="mono">{kes(v)}</b></div>)}
              {!Object.keys(sum.byMethod).length && <div class="card-b mute">{t('No sales yet')}</div>}
            </div>
            <div class="card">
              <div class="card-h"><h3>{t('Cash in & out')}</h3></div>
              {sum.moves.map((m) => <div class="list-item"><Icon name={m.type === 'pay_in' ? 'download' : 'upload'} /><div class="grow"><b>{m.reason}</b><div class="small mute">{new Date(m.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} · {t({ pay_in: 'Pay in', pay_out: 'Pay out', drop: 'Cash drop' }[m.type])}</div></div><b class={'mono ' + (m.type === 'pay_in' ? 'up' : 'down')}>{m.type === 'pay_in' ? '+' : '-'}{kes(m.amount)}</b></div>)}
              {!sum.moves.length && <div class="card-b mute">{t('No cash moved in or out yet')}</div>}
            </div>
          </div>
        </>
      )}
      <h2 class="mb mt-l">{t('Shift history')}</h2>
      <div class="card">
        <Table rows={hist} empty={<Empty icon="history" title={t('No closed shifts yet')} />} onRowClick={(s) => xReport(s)} columns={[
          { key: 'opened_at', label: t('Opened'), render: (s) => dt(s.opened_at) },
          { key: 'closed_at', label: t('Closed'), render: (s) => (s.closed_at ? new Date(s.closed_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '') },
          { key: 'user_id', label: t('Cashier'), render: (s) => users.find((u) => u.id === s.user_id)?.name || '' },
          { key: 'tot', label: t('Takings'), num: true, render: (s) => kes(Object.values(s.totals_by_method || {}).reduce((a, b) => a + b, 0)) },
          { key: 'expected_cash', label: t('Expected'), num: true, render: (s) => kes(s.expected_cash) },
          { key: 'counted_cash', label: t('Counted'), num: true, render: (s) => kes(s.counted_cash) },
          { key: 'variance', label: t('Variance'), num: true, render: (s) => <Badge tone={s.variance < 0 ? 'bad' : s.variance > 0 ? 'warn' : 'ok'}>{s.variance > 0 ? '+' : ''}{kes(s.variance)}</Badge> }
        ]} />
      </div>
    </div>
  );
}
