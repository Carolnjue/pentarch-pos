import { useState } from 'preact/hooks';
import { Btn, Switch, Input, MoneyInput } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { saveBusiness } from '../../auth/session.js';
import { money } from '../../lib/money.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export default function LoyaltyPanel() {
  const st = S.settings.value;
  const [f, setF] = useState({ loyalty_enabled: st.loyalty_enabled, loyalty_earn_per: st.loyalty_earn_per, loyalty_point_value: st.loyalty_point_value, pay_credit: st.pay_credit, pay_points: st.pay_points });
  const set = (p) => setF({ ...f, ...p });
  const go = async () => { await saveBusiness({ settings: { ...f, loyalty_earn_per: +f.loyalty_earn_per || 100, pay_points: f.loyalty_enabled && f.pay_points }, modules: { loyalty: f.loyalty_enabled, credit: f.pay_credit } }); toast(t('Saved')); };
  return (
    <div class="card">
      <div class="card-h"><h3>{t('Loyalty & credit')}</h3><Btn variant="primary" onClick={go}>{t('Save')}</Btn></div>
      <div class="card-b">
        <div class="set-row"><div class="d"><b>{t('Credit sales (debtors)')}</b><small>{t('Allow selling on account to known customers')}</small></div><Switch checked={f.pay_credit} onChange={(v) => set({ pay_credit: v })} /></div>
        <div class="set-row"><div class="d"><b>{t('Loyalty points')}</b><small>{t('Customers earn points on every purchase')}</small></div><Switch checked={f.loyalty_enabled} onChange={(v) => set({ loyalty_enabled: v })} /></div>
        {f.loyalty_enabled && <>
          <div class="form-grid mt">
            <Input label={t('Earn 1 point for every KES')} type="number" value={f.loyalty_earn_per} onValue={(v) => set({ loyalty_earn_per: v })} />
            <MoneyInput label={t('Value of 1 point when redeeming')} value={f.loyalty_point_value} onValue={(v) => set({ loyalty_point_value: v })} />
          </div>
          <div class="set-row"><div class="d"><b>{t('Let customers pay with points')}</b></div><Switch checked={f.pay_points} onChange={(v) => set({ pay_points: v })} /></div>
          <div class="callout ok"><span>{t('Example: a KES 1,000 purchase earns {p} points, worth {v}.', { p: Math.floor(1000 / (+f.loyalty_earn_per || 100)), v: money(Math.floor(1000 / (+f.loyalty_earn_per || 100)) * f.loyalty_point_value) })}</span></div>
        </>}
      </div>
    </div>
  );
}
