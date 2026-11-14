import { useEffect, useRef } from 'preact/hooks';
import { toast, hideToast } from '../store.js';
import { stageLabel, t } from '../i18n.js';

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  leads: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 3.65a3.5 3.5 0 0 1 0 6.7',
  plus: 'M12 5v14M5 12h14',
  money: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v.01M18 14v.01',
  more: 'M4 6h16M4 12h16M4 18h16',
  phone: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  sms: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12zM8 11h.01M12 11h.01M16 11h.01',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  rocket: 'M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 5-9 13-9 0 8-5 12-9 13zM15 9.01V9',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  back: 'M15 18l-6-6 6-6',
  chevron: 'M9 6l6 6-6 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  sync: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  check: 'M5 12.5l4.2 4.2L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  user: 'M20 21v-1.5A4.5 4.5 0 0 0 15.5 15h-7A4.5 4.5 0 0 0 4 19.5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  cloudoff: 'M3 3l18 18M8 17H6a4 4 0 0 1-.9-7.9M10.5 6.2A5.5 5.5 0 0 1 17.5 10H18a3 3 0 0 1 1.8 5.4',
  note: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h4',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM10 22l2-7 3 3v4M7 12l3-4 4 1 2 3M12 15l-2-3',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 19h14',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  arrow: 'M5 12h14M13 6l6 6-6 6'
};

export function Icon({ name, size = 22, stroke = 1.9, ...rest }) {
  if (name === 'wa') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
        <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...rest}>
      <path d={PATHS[name] || ''} fill="none" stroke="currentColor" stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function Stage({ s, small }) {
  return <span class={`stage stage--${s}${small ? ' stage--sm' : ''}`}>{stageLabel(s)}</span>;
}

export function Toast() {
  const v = toast.value;
  if (!v) return null;
  return (
    <div class={`toast toast--${v.tone}${v.action ? ' toast--act' : ''}`} role="status" key={v.id}>
      <Icon name={v.tone === 'err' ? 'x' : v.tone === 'off' ? 'cloudoff' : 'check'} size={18} />
      <span>{v.text}</span>
      {v.action && <button class="toast__btn" onClick={() => { hideToast(); v.action.run(); }}>{v.action.label}</button>}
    </div>
  );
}

/** Bottom sheet dialog (full-height on phones, centred card on desktop). */
export function Sheet({ title, onClose, children, footer }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const f = el && el.querySelector('input,select,textarea,button:not(.sheet__x)');
    if (f) setTimeout(() => f.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); if (prev && prev.focus) prev.focus(); };
  }, []);
  return (
    <div class="sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div class="sheet__head">
          <h2>{title}</h2>
          <button class="sheet__x icon-btn" onClick={onClose} aria-label={t('Cancel')}><Icon name="x" /></button>
        </div>
        <div class="sheet__body">{children}</div>
        {footer && <div class="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children, optional, required }) {
  return (
    <label class={`field${error ? ' field--err' : ''}`}>
      <span class="field__label">{label}{required && <b class="req" aria-hidden="true"> *</b>}{optional && <em> · {t('Optional')}</em>}</span>
      {children}
      {error ? <span class="field__err">{error}</span> : hint ? <span class="field__hint">{hint}</span> : null}
    </label>
  );
}

export function Empty({ icon = 'leads', title, text, action }) {
  return (
    <div class="empty">
      <div class="empty__icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 3 }) {
  return <div class="skel">{Array.from({ length: rows }, (_, i) => <div key={i} class="skel__row" />)}</div>;
}

export function Mark({ size = 30 }) {
  return <img src="/pos/agents/brand/pentarch-mark.svg" width={size} height={size} alt="" class="mark" />;
}
