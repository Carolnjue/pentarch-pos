// Services ↔ Sell screen: "served by" chip on each service line and a fast staff picker (big photo-style tiles).
import { cart, updateLine } from '../sell/cart.js';
import { openModal, Modal } from '../../ui/overlay.jsx';
import { Avatar, Icon, Btn } from '../../ui/kit.jsx';
import { catalog } from '../../db/catalog.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';
import { serviceStaff, isService } from './logic.js';
import './services.css';

/** Ask who served a line. Resolves the staff id ('' = nobody) or null when closed. */
export const pickStaff = (title, current) => openModal((close) => <StaffPick title={title} current={current} close={close} />);
function StaffPick({ title, current, close }) {
  const staff = serviceStaff();
  return (
    <Modal title={title} icon="scissors" size="lg" onClose={() => close(null)}>
      <div class="sp-grid" role="listbox" aria-label={t('Staff')}>
        {staff.map((u) => (
          <button role="option" aria-selected={u.id === current} class={'sp-tile' + (u.id === current ? ' on' : '')} onClick={() => close(u.id)}>
            <Avatar name={u.name} size={52} />
            <b class="ellipsis">{u.name.split(' ')[0]}</b>
            <span class="small mute ellipsis">{u.commission_pct ? t('{n}% commission', { n: u.commission_pct }) : t(u.role === 'owner' ? 'Owner' : u.role === 'manager' ? 'Manager' : 'Staff')}</span>
          </button>
        ))}
      </div>
      <Btn variant="ghost" class="block mt" onClick={() => close('')}>{t('Nobody / not a service')}</Btn>
    </Modal>
  );
}

function LineExtra({ l }) {
  const p = catalog.value.byId.get(l.product_id);
  if (!isService(p) && !l.staff_id) return null;
  const u = l.staff_id && S.users.value.find((x) => x.id === l.staff_id);
  const pick = async (e) => { e.stopPropagation(); const id = await pickStaff(t('Who did {name}?', { name: l.name }), l.staff_id); if (id !== null) updateLine(l.key, { staff_id: id || null }); };
  return (
    <button class={'staff-chip' + (u ? '' : ' none')} onClick={pick} aria-label={t('Served by')}>
      <Icon name="scissors" size={12} />{u ? u.name.split(' ')[0] : t('Choose staff')}<Icon name="chevron-left" size={11} style={{ transform: 'rotate(-90deg)' }} />
    </button>
  );
}

export const sellExt = {
  LineExtra,
  async afterAdd(key, p) {
    // default: ask only when someone earns commission (salons); cyber / print shops are not interrupted
    const ask = S.settings.value.services_ask_staff;
    if (!isService(p) || ask === false || (ask !== true && !serviceStaff().some((u) => u.commission_pct > 0))) return;
    const line = cart.value.lines.find((x) => x.key === key);
    if (!line) return;
    const id = await pickStaff(t('Who is doing {name}?', { name: p.name }), line.staff_id);
    if (id !== null && cart.value.lines.find((x) => x.key === key)) updateLine(key, { staff_id: id || null });
  }
};
