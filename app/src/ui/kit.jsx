// Small UI primitives.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.jsx';
import { t } from '../i18n/index.js';
import { money, parseMoney } from '../lib/money.js';
import { cls } from '../lib/util.js';

export { Icon };
export const Kbd = ({ children }) => <kbd class="kbd">{children}</kbd>;
export const Badge = ({ tone, children, title }) => <span class={'badge ' + (tone || '')} title={title}>{children}</span>;
export const Money = ({ v, dec, class: c }) => <span class={'mono ' + (c || '')}>{money(v, { dec })}</span>;

export function Btn({ icon, kbd, children, variant = '', size = '', class: c, iconSize, ...p }) {
  return (
    <button type="button" class={cls('btn', variant, size, !children && icon && 'icon', c)} {...p}>
      {icon && <Icon name={icon} size={iconSize || (size === 'xs' ? 15 : size === 'sm' ? 17 : 19)} />}
      {children}
      {kbd && <span class="kbd">{kbd}</span>}
    </button>
  );
}

export function Field({ label, hint, error, children, class: c, htmlFor }) {
  return (
    <div class={cls('field', c)}>
      {label && <label for={htmlFor}>{label}</label>}
      {children}
      {error ? <span class="err">{error}</span> : hint ? <span class="hint">{hint}</span> : null}
    </div>
  );
}

let fid = 0;
export function Input({ label, hint, error, icon, value, onValue, class: c, inputClass, suffix, id: givenId, ...p }) {
  const auto = useRef('f' + ++fid).current;
  const id = givenId || auto;
  const inp = <input id={id} class={cls('input', error && 'bad', inputClass)} value={value ?? ''} onInput={(e) => onValue?.(e.target.value)} {...p} />;
  return (
    <Field label={label} hint={hint} error={error} class={c} htmlFor={id}>
      {icon || suffix ? <div class="input-wrap">{icon && <Icon name={icon} size={18} />}{inp}{suffix && <div class="suf">{suffix}</div>}</div> : inp}
    </Field>
  );
}
export function Select({ label, hint, value, onValue, options, class: c, ...p }) {
  const id = useRef('f' + ++fid).current;
  return (
    <Field label={label} hint={hint} class={c} htmlFor={id}>
      <select id={id} class="input" value={value ?? ''} onChange={(e) => onValue?.(e.target.value)} {...p}>
        {options.map((o) => (typeof o === 'string' ? <option value={o}>{o}</option> : <option value={o.value} disabled={o.disabled}>{o.label}</option>))}
      </select>
    </Field>
  );
}
export function Textarea({ label, hint, value, onValue, class: c, ...p }) {
  const id = useRef('f' + ++fid).current;
  return <Field label={label} hint={hint} class={c} htmlFor={id}><textarea id={id} class="input" value={value ?? ''} onInput={(e) => onValue?.(e.target.value)} {...p} /></Field>;
}

/** Money input: value/onValue in cents. Shows "KES" prefix, accepts "1,250.50". */
export function MoneyInput({ label, hint, error, value, onValue, class: c, big, ...p }) {
  const id = useRef('f' + ++fid).current;
  const [txt, setTxt] = useState(value ? String(value / 100) : '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(value ? String(value / 100) : ''); }, [value]);
  return (
    <Field label={label} hint={hint} error={error} class={c} htmlFor={id}>
      <div class="input-wrap">
        <span class="pre">KES</span>
        <input id={id} class={cls('input num mono', big && 'amount-in', error && 'bad')} inputMode="decimal" value={txt} autocomplete="off"
          onFocus={(e) => { focused.current = true; e.target.select(); }}
          onBlur={() => { focused.current = false; const v = parseMoney(txt); if (!isNaN(v)) setTxt(v ? String(v / 100) : ''); }}
          onInput={(e) => { setTxt(e.target.value); const v = parseMoney(e.target.value); if (!isNaN(v)) onValue?.(v); }} {...p} />
      </div>
    </Field>
  );
}

export function Switch({ checked, onChange, label, sub, disabled }) {
  return (
    <label class="switch" style={{ opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span class="track" />
      {label && <span><b style={{ fontWeight: 600 }}>{label}</b>{sub && <small class="mute" style={{ display: 'block', fontSize: '13px' }}>{sub}</small>}</span>}
    </label>
  );
}
export const Check = ({ checked, onChange, label, disabled }) => (
  <label class="check"><input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />{label}</label>
);
export function Seg({ value, onValue, options, class: c }) {
  return (
    <div class={'seg ' + (c || '')} role="radiogroup">
      {options.map((o) => <button type="button" role="radio" aria-checked={value === o.value} class={value === o.value ? 'on' : ''} onClick={() => onValue(o.value)}>{o.icon && <Icon name={o.icon} size={16} />}{o.label}</button>)}
    </div>
  );
}
export function Tabs({ value, onValue, tabs }) {
  return (
    <div class="tabs" role="tablist">
      {tabs.map((x) => <button role="tab" aria-selected={value === x.value} class={value === x.value ? 'on' : ''} onClick={() => onValue(x.value)}>{x.icon && <Icon name={x.icon} size={16} />}{x.label}{x.count != null && <span class="badge">{x.count}</span>}</button>)}
    </div>
  );
}
export function PageHeader({ title, sub, actions, back }) {
  return (
    <div class="page-h">
      {back && <a class="btn ghost icon" href={back} aria-label={t('Back')}><Icon name="arrow-left" /></a>}
      <div class="t"><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {actions && <div class="actions">{actions}</div>}
    </div>
  );
}
export function Empty({ icon = 'box', title, text, children }) {
  return (
    <div class="empty">
      <div class="art"><Icon name={icon} size={32} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
export const Skeleton = ({ h = 16, w = '100%', r, style }) => <div class="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
export function SkeletonRows({ n = 6, h = 44 }) { return <div class="col gap-s">{Array.from({ length: n }, () => <Skeleton h={h} />)}</div>; }

const AV = ['#1F3C7A', '#0A7F7B', '#C9301F', '#B97A00', '#182A55', '#5b3a8c'];
export function Avatar({ name = '?', size, color }) {
  const ini = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <span class="avatar" style={{ background: color || AV[h % AV.length], ...(size ? { width: size, height: size, fontSize: size * 0.38 } : {}) }}>{ini || '?'}</span>;
}

export function SearchBox({ value, onValue, placeholder, autofocus, inputRef, onKeyDown, class: c }) {
  return (
    <div class={'input-wrap ' + (c || '')} style={{ minWidth: '220px', flex: 1 }}>
      <Icon name="search" size={18} />
      <input ref={inputRef} class="input" type="search" value={value} placeholder={placeholder || t('Search')} onInput={(e) => onValue(e.target.value)} autoFocus={autofocus} onKeyDown={onKeyDown} aria-label={placeholder || t('Search')} />
    </div>
  );
}
export function FilterBar({ children }) { return <div class="row wrap mb" style={{ gap: '8px' }}>{children}</div>; }

export function Stat({ label, value, delta, icon, tone, children }) {
  return (
    <div class="card stat">
      <div class="k">{icon && <Icon name={icon} size={16} />}{label}</div>
      <div class="v">{value}</div>
      {delta != null && <div class={'d ' + (tone || (delta >= 0 ? 'up' : 'down'))}>{typeof delta === 'number' ? (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta).toFixed(0) + '%' : delta}</div>}
      {children}
    </div>
  );
}

/** Number pad. onKey receives '0'-'9', '00', '.', 'back', 'clear', 'ok'. */
export function NumPad({ onKey, dark, okLabel, showDot = true, extra }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', showDot ? '.' : 'clear', '0', 'back'];
  return (
    <div class={'numpad' + (dark ? ' dark' : '')}>
      {keys.map((k) => (
        <button type="button" class={k.length > 2 ? 'fn' : ''} onClick={() => onKey(k)} aria-label={k === 'back' ? t('Delete') : k === 'clear' ? t('Clear') : k}>
          {k === 'back' ? <Icon name="backspace" size={24} /> : k === 'clear' ? t('Clear') : k}
        </button>
      ))}
      {extra}
      {okLabel && <button type="button" class="fn" style={{ gridColumn: '1 / -1', background: 'var(--teal-d)', color: '#fff', borderColor: 'var(--teal-d)' }} onClick={() => onKey('ok')}>{okLabel}</button>}
    </div>
  );
}

export function Progress({ value }) { return <div class="progress"><i style={{ width: Math.max(0, Math.min(100, value)) + '%' }} /></div>; }
