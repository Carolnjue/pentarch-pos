import { useEffect, useState } from 'preact/hooks';
import { homeFigures } from './data.js';
import { widgets } from '../index.js';
import { Btn, Icon, SkeletonRows, Kbd } from '../../ui/kit.jsx';
import { money } from '../../lib/money.js';
import { on } from '../../lib/bus.js';
import { navigate } from '../../router.js';
import { can } from '../../auth/permissions.js';
import { openShiftDialog } from '../shifts/dialogs.jsx';
import * as S from '../../state.js';
import { t, tn } from '../../i18n/index.js';

const SPAN = { sm: 'span 1', md: 'span 2', lg: 'span 3', full: '1 / -1' };
export default function HomePage() {
  const [f, setF] = useState(null);
  useEffect(() => { const load = () => homeFigures().then(setF); load(); return on('change', (e) => e === 'sales' && load()); }, [S.branch.value?.id]);
  const h = new Date().getHours();
  const greet = h < 12 ? t('Good morning') : h < 17 ? t('Good afternoon') : t('Good evening');
  const u = S.user.value;
  const full = can('dashboard.view');
  return (
    <div class="page">
      <div class="page-h">
        <div class="t">
          <h1>{greet}, {u?.name.split(' ')[0]}</h1>
          <p>{new Date().toLocaleDateString(S.lang.value === 'sw' ? 'sw-KE' : 'en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {S.branch.value?.name}</p>
        </div>
        <div class="actions">
          {can('sell.use') && <Btn variant="primary" size="lg" icon="cart" onClick={() => navigate('/sell')}>{t('New sale')}<Kbd>F2</Kbd></Btn>}
          {can('products.edit') && <Btn icon="plus" size="lg" onClick={() => navigate('/products/new')}>{t('Add product')}</Btn>}
          {!S.shift.value && can('shift.open_close') && <Btn icon="clock" size="lg" onClick={openShiftDialog}>{t('Open shift')}</Btn>}
        </div>
      </div>
      {!f ? <SkeletonRows n={6} h={90} /> : full ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))', gap: '16px' }}>
          {widgets().map((w) => <div style={{ gridColumn: SPAN[w.size || 'sm'] }} class="home-w">{<w.component f={f} />}</div>)}
        </div>
      ) : (
        <div class="grid3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div class="card stat"><div class="k"><Icon name="receipt" size={16} />{t('My sales today')}</div><div class="v">{money(f.mine.total)}</div><div class="small mute" style={{ marginTop: '4px' }}>{tn(f.mine.count, '{n} sale', '{n} sales')}</div></div>
          <div class="card stat"><div class="k"><Icon name="clock" size={16} />{t('Shift')}</div><div class="v" style={{ fontSize: '20px' }}>{S.shift.value ? t('Open') : t('Not open')}</div></div>
        </div>
      )}
    </div>
  );
}
