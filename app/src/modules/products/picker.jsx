// Product picker dialog (search + choose). Used by recipes, labels and other modules.
import { useState, useMemo } from 'preact/hooks';
import { openModal, Modal } from '../../ui/overlay.jsx';
import { Icon, Badge } from '../../ui/kit.jsx';
import { catalog, searchProducts, levels } from '../../db/catalog.js';
import { kes } from '../../lib/money.js';
import { t } from '../../i18n/index.js';

/** Resolve with a product (or null). opts.filter(p) to restrict. */
export const pickProduct = (opts = {}) => openModal((close) => <Picker close={close} {...opts} />);
function Picker({ close, filter, title }) {
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const list = useMemo(() => {
    const base = q.trim() ? searchProducts(q, 80) : catalog.value.products.filter((p) => !p.has_variants && p.active !== false).slice(0, 80);
    return filter ? base.filter(filter) : base;
  }, [q]);
  return (
    <Modal title={title || t('Choose a product')} icon="search" size="lg" onClose={() => close(null)}>
      <div class="input-wrap mb"><Icon name="search" size={18} /><input class="input" autoFocus value={q} placeholder={t('Search or scan')} aria-label={t('Search')} data-scan="keep"
        onInput={(e) => { setQ(e.target.value); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(list.length - 1, hi + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(0, hi - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); const exact = catalog.value.byCode.get(q.trim()); close(exact?.product || list[hi] || null); }
        }} /></div>
      <div class="card" style={{ maxHeight: '52vh', overflow: 'auto' }}>
        {list.map((p, i) => (
          <div class={'list-item click'} style={i === hi ? { background: 'var(--navy-50)' } : null} onMouseEnter={() => setHi(i)} onClick={() => close(p)}>
            <div class="grow"><b>{p.name}</b><div class="small mute mono">{[p.sku, p.barcode].filter(Boolean).join(' · ')}</div></div>
            {p.track_stock && <Badge>{Math.round((levels.value.get(p.id) || 0) * 100) / 100} {p.unit}</Badge>}
            <b class="mono">{kes(p.price)}</b>
          </div>
        ))}
        {!list.length && <div class="empty">{t('Nothing found')}</div>}
      </div>
    </Modal>
  );
}
