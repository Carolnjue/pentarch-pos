// Manager override: run a restricted action. If the current user lacks the permission, ask for the PIN of someone who has it.
import { useState, useRef, useLayoutEffect } from 'preact/hooks';
import { openModal, Modal } from '../ui/overlay.jsx';
import { NumPad, Icon } from '../ui/kit.jsx';
import { can, allPerms } from './permissions.js';
import { userByPin } from './session.js';
import { audit } from '../db/repo.js';
import { user } from '../state.js';
import { t } from '../i18n/index.js';

/**
 * Resolve with the approving user (current user if allowed), or null if cancelled.
 * Usage: const by = await requirePerm('sell.void', t('Void sale')); if (!by) return;
 */
export async function requirePerm(key, actionLabel, { test } = {}) {
  const ok = (u) => can(key, u) && (!test || test(u));
  if (ok(user.value)) return user.value;
  const perm = allPerms().find((p) => p.key === key);
  const approver = await openModal((close) => <OverrideDialog label={actionLabel || t(perm?.label || key)} check={ok} close={close} />);
  if (approver) await audit('override.grant', 'users', approver.id, { perm: key, action: actionLabel, for_user: user.value?.id, approver: approver.name });
  return approver || null;
}

function OverrideDialog({ label, check, close }) {
  const [pin, setPinState] = useState('');
  const [err, setErr] = useState('');
  const pinRef = useRef('');
  const setPin = (v) => { pinRef.current = v; setPinState(v); };
  const submit = (p = pinRef.current) => {
    const u = userByPin(p);
    if (u && check(u)) close(u);
    else { setErr(u ? t('{name} is not allowed to do this.', { name: u.name }) : t('Wrong PIN')); setPin(''); }
  };
  const key = (k) => {
    setErr('');
    const cur = pinRef.current;
    if (k === 'back') return setPin(cur.slice(0, -1));
    if (k === 'clear') return setPin('');
    if (k === 'ok') return submit();
    if (cur.length < 6) { const p = cur + k; setPin(p); const u = p.length >= 4 ? userByPin(p) : null; if (u && check(u)) submit(p); else if (p.length === 6) submit(p); }
  };
  useLayoutEffect(() => {
    const h = (e) => {
      if (/^\d$/.test(e.key)) { e.preventDefault(); key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); key('back'); } else if (e.key === 'Enter') { e.preventDefault(); key('ok'); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, []);
  return (
    <Modal title={t('Manager approval needed')} icon="shield" size="sm" center onClose={() => close(null)}>
      <p class="mute" style={{ marginTop: 0 }}>{t('Ask a manager to enter their PIN to approve:')} <b style={{ color: 'var(--text)' }}>{label}</b></p>
      <div class={'pin-dots' + (err ? ' shake' : '')} style={{ color: 'var(--ink)' }}>{[0, 1, 2, 3].map((i) => <i class={pin.length > i ? 'on' : ''} />)}</div>
      {err && <div class="callout bad mb"><Icon name="alert" size={18} />{err}</div>}
      <NumPad onKey={key} showDot={false} okLabel={t('Approve')} />
    </Modal>
  );
}
