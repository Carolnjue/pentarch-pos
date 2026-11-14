// Modal stack, drawers, toasts, menus, confirm/prompt dialogs.
import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { t } from '../i18n/index.js';

/* ---------- modal stack ---------- */
export const modals = signal([]);
let mid = 0;
/** Open a modal. render(close) returns JSX; resolves with the value passed to close(). */
export function openModal(render) {
  return new Promise((resolve) => {
    const id = ++mid;
    modals.value = [...modals.value, { id, render, resolve }];
  });
}
function closeModal(id, v) {
  const m = modals.value.find((x) => x.id === id);
  modals.value = modals.value.filter((x) => x.id !== id);
  m?.resolve(v);
}
export const closeAllModals = () => { for (const m of [...modals.value]) closeModal(m.id, undefined); };
export const hasModal = () => modals.value.length > 0;
export function ModalHost() {
  return <>{modals.value.map((m) => <ModalSlot key={m.id} m={m} />)}</>;
}
function ModalSlot({ m }) { return m.render((v) => closeModal(m.id, v)); }

const escStack = [];
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && escStack.length) { e.preventDefault(); e.stopImmediatePropagation(); escStack[escStack.length - 1](); }
  }, true);
}
function useEscape(fn, active = true) {
  const ref = useRef(fn); ref.current = fn;
  useLayoutEffect(() => {
    if (!active) return;
    const h = () => ref.current?.();
    escStack.push(h);
    return () => { const i = escStack.lastIndexOf(h); if (i >= 0) escStack.splice(i, 1); };
  }, [active]);
}
function useFocusTrap(ref) {
  useLayoutEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const first = el?.querySelector('[autofocus], [data-autofocus]') || el?.querySelector('.modal-b input:not([type=hidden]):not([disabled]):not(.sr), .modal-b select, .modal-b textarea') || el?.querySelector('.modal-f .btn.primary, .modal-b button:not([disabled]), .modal-f button') || el?.querySelector('button');
    first?.focus?.();
    const onKey = (e) => {
      if (e.key !== 'Tab' || !el) return;
      const f = [...el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    el?.addEventListener('keydown', onKey);
    return () => { el?.removeEventListener('keydown', onKey); try { prev?.focus?.({ preventScroll: true }); } catch {} };
  }, []);
}

/** Standard dialog. */
export function Modal({ title, icon, iconColor, onClose, children, footer, size = '', center, dismissable = true, class: cls, headExtra }) {
  const ref = useRef();
  useEscape(() => dismissable && onClose?.());
  useFocusTrap(ref);
  return (
    <div class={'overlay' + (center ? ' centered' : '')} onMouseDown={(e) => { if (e.target === e.currentTarget && dismissable) onClose?.(); }}>
      <div class={'modal ' + size + ' ' + (cls || '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        {title !== undefined && (
          <div class="modal-h">
            {icon && <div class="ico-bub" style={{ background: iconColor || 'var(--navy-50)', color: iconColor ? '#fff' : 'var(--navy)' }}><Icon name={icon} /></div>}
            <h2>{title}</h2>
            {headExtra}
            {dismissable && <button class="btn ghost icon sm" onClick={() => onClose?.()} aria-label={t('Close')}><Icon name="x" /></button>}
          </div>
        )}
        <div class="modal-b">{children}</div>
        {footer && <div class="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer, wide, headExtra }) {
  const ref = useRef();
  useEscape(() => onClose?.());
  useFocusTrap(ref);
  return (
    <div class="overlay drawer-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div class={'drawer' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div class="modal-h" style={{ borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
          <h2>{title}</h2>{headExtra}
          <button class="btn ghost icon sm" onClick={onClose} aria-label={t('Close')}><Icon name="x" /></button>
        </div>
        <div class="modal-b" style={{ paddingTop: '16px' }}>{children}</div>
        {footer && <div class="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

export function confirm({ title, message, ok, cancel, danger, icon }) {
  return openModal((close) => (
    <Modal title={title || t('Are you sure?')} icon={icon || (danger ? 'alert' : 'help')} iconColor={danger ? 'var(--coral-d)' : undefined} size="sm" center onClose={() => close(false)}
      footer={<><button class="btn" onClick={() => close(false)}>{cancel || t('Cancel')}</button><button class={'btn ' + (danger ? 'primary' : 'navy')} data-autofocus onClick={() => close(true)}>{ok || t('Yes, continue')}</button></>}>
      {message && <p style={{ margin: 0 }}>{message}</p>}
    </Modal>
  ));
}

export function promptText({ title, label, value = '', placeholder, type = 'text', ok, required, hint, multiline, options }) {
  return openModal((close) => <PromptBody {...{ title, label, value, placeholder, type, ok, required, hint, multiline, options, close }} />);
}
function PromptBody({ title, label, value, placeholder, type, ok, required, hint, multiline, options, close }) {
  const [v, setV] = useState(value);
  const submit = (e) => { e?.preventDefault(); if (required && !String(v).trim()) return; close(v); };
  return (
    <Modal title={title} size="sm" center onClose={() => close(null)}
      footer={<><button class="btn" onClick={() => close(null)}>{t('Cancel')}</button><button class="btn primary" onClick={submit} disabled={required && !String(v).trim()}>{ok || t('Save')}</button></>}>
      <form onSubmit={submit} class="col">
        {options && <div class="row wrap gap-s">{options.map((o) => <button type="button" class={'chip' + (v === o ? ' on' : '')} onClick={() => setV(o)}>{o}</button>)}</div>}
        <div class="field">
          {label && <label>{label}</label>}
          {multiline
            ? <textarea class="input" value={v} placeholder={placeholder} onInput={(e) => setV(e.target.value)} data-autofocus />
            : <input class="input" type={type} value={v} placeholder={placeholder} onInput={(e) => setV(e.target.value)} data-autofocus />}
          {hint && <span class="hint">{hint}</span>}
        </div>
      </form>
    </Modal>
  );
}

/* ---------- toasts ---------- */
export const toasts = signal([]);
let tid = 0;
export function toast(msg, opts = {}) {
  const id = ++tid;
  const tt = { id, msg, type: opts.type || 'ok', action: opts.action, icon: opts.icon };
  toasts.value = [...toasts.value.slice(-3), tt];
  setTimeout(() => { toasts.value = toasts.value.filter((x) => x.id !== id); }, opts.ms || (opts.action ? 6000 : 3200));
}
toast.error = (msg, o = {}) => toast(msg, { ...o, type: 'bad' });
toast.warn = (msg, o = {}) => toast(msg, { ...o, type: 'warn' });
export function ToastHost() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((x) => (
        <div class={'toast ' + x.type} key={x.id}>
          <Icon name={x.icon || (x.type === 'bad' ? 'alert' : x.type === 'warn' ? 'info' : 'check-circle')} />
          <span>{x.msg}</span>
          {x.action && <button class="btn" onClick={() => { x.action.fn(); toasts.value = toasts.value.filter((y) => y.id !== x.id); }}>{x.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

/* ---------- dropdown menu ---------- */
export function Dropdown({ trigger, children, align = 'right', width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEscape(() => setOpen(false), open);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div class="menu" style={{ [align]: 0, top: 'calc(100% + 6px)', width }} onClick={(e) => { if (e.target.closest('button,a')) setOpen(false); }}>
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}
export { useEscape };
