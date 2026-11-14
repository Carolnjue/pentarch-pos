// Home: today's appointments (next few).
import { useEffect, useState } from 'preact/hooks';
import { Badge, Empty, Avatar } from '../../ui/kit.jsx';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';
import { appointmentsOn } from './logic.js';

const hm = (ms) => new Date(ms).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
export function AppointmentsWidget() {
  const [list, setList] = useState(null);
  useEffect(() => { const load = () => appointmentsOn(Date.now()).then(setList); load(); return on('change', (e) => e === 'appointments' && load()); }, []);
  if (!list) return <div class="card" />;
  const next = list.filter((a) => ['booked', 'arrived'].includes(a.status));
  return (
    <div class="card" style={{ height: '100%' }}>
      <div class="card-h"><h3>{t('Today’s appointments')}</h3><Badge tone="navy">{next.length}</Badge></div>
      {next.slice(0, 6).map((a) => {
        const u = S.users.value.find((x) => x.id === a.staff_id);
        return (
          <div class="list-item click" onClick={() => navigate('/appointments')}>
            <b class="mono" style={{ minWidth: '48px' }}>{hm(a.start)}</b>
            <span class="grow ellipsis">{a.customer_name}<div class="tiny mute ellipsis">{a.service_name}</div></span>
            {a.status === 'arrived' ? <Badge tone="warn">{t('In the chair')}</Badge> : u && <Avatar name={u.name} size={26} />}
          </div>
        );
      })}
      {!next.length && <Empty icon="calendar" title={t('No more bookings today')} text={t('Book clients from Appointments.')} />}
    </div>
  );
}
