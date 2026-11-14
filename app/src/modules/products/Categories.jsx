import { useState } from 'preact/hooks';
import { catalog } from '../../db/catalog.js';
import { save, saveMany, remove } from '../../db/repo.js';
import { PageHeader, Btn, Icon, Input, Empty, Badge } from '../../ui/kit.jsx';
import { openModal, Modal, toast, confirm } from '../../ui/overlay.jsx';
import { CATEGORY_COLORS } from '../../presets/types.js';
import { t, tn } from '../../i18n/index.js';

const ICONS = ['box', 'droplet', 'package', 'flame', 'sparkle', 'coffee', 'phone', 'leaf', 'scale', 'smile', 'gift', 'wrench', 'layers', 'hash', 'zap', 'shirt', 'bag', 'tag', 'pill', 'shield', 'sun', 'utensils', 'wine', 'cake', 'scissors', 'book', 'monitor', 'car', 'star', 'file', 'filter', 'edit'];

export const quickCategory = (cat) => openModal((close) => <CatEditor cat={cat} close={close} />);
function CatEditor({ cat, close }) {
  const [f, setF] = useState(cat || { name: '', color: CATEGORY_COLORS[catalog.value.categories.length % CATEGORY_COLORS.length], icon: 'box', sort: catalog.value.categories.length, parent_id: null });
  const go = async () => {
    if (!f.name.trim()) return toast.error(t('Enter a name'));
    close(await save('categories', { ...f, name: f.name.trim() }, { audit: { action: cat ? 'category.update' : 'category.create', details: { name: f.name } } }));
  };
  return (
    <Modal title={cat ? t('Edit category') : t('New category')} icon="tags" onClose={() => close(null)} footer={<><Btn onClick={() => close(null)}>{t('Cancel')}</Btn><Btn variant="primary" onClick={go}>{t('Save')}</Btn></>}>
      <div class="col">
        <Input label={t('Name')} value={f.name} onValue={(v) => setF({ ...f, name: v })} autoFocus onKeyDown={(e) => e.key === 'Enter' && go()} />
        <div class="field"><label>{t('Colour')}</label><div class="row wrap gap-s">{CATEGORY_COLORS.map((c) => <button class={'swatch' + (f.color === c ? ' on' : '')} style={{ background: c }} aria-label={c} onClick={() => setF({ ...f, color: c })} />)}</div></div>
        <div class="field"><label>{t('Icon')}</label><div class="icon-pick">{ICONS.map((i) => <button class={f.icon === i ? 'on' : ''} aria-label={i} onClick={() => setF({ ...f, icon: i })}><Icon name={i} size={18} /></button>)}</div></div>
        <div class="tile" style={{ '--c': f.color, height: '96px', width: '170px', cursor: 'default' }}><span class="nm">{f.name || t('Preview')}</span><span class="pr">KES 120</span></div>
      </div>
    </Modal>
  );
}

export default function Categories() {
  const cats = catalog.value.categories;
  const counts = {};
  for (const p of catalog.value.products) if (!p.parent_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1;
  const move = async (i, d) => {
    const list = cats.slice();
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await saveMany('categories', list.map((c, k) => ({ ...c, sort: k })));
  };
  const del = async (c) => {
    if (counts[c.id] && !(await confirm({ title: t('Delete {name}?', { name: c.name }), message: t('{n} products will have no category.', { n: counts[c.id] }), danger: true, ok: t('Delete') }))) return;
    await remove('categories', c.id, { audit: { action: 'category.delete', details: { name: c.name } } });
  };
  return (
    <div class="page" style={{ maxWidth: '900px' }}>
      <PageHeader back="#/products" title={t('Categories')} sub={t('Colours and icons show on the Sell screen quick keys.')} actions={<Btn variant="primary" icon="plus" onClick={() => quickCategory()}>{t('New category')}</Btn>} />
      <div class="card">
        {cats.map((c, i) => (
          <div class="list-item">
            <span class="ico-bub" style={{ background: c.color, color: '#fff' }}><Icon name={c.icon || 'box'} size={18} /></span>
            <div class="grow"><b>{c.name}</b><div class="small mute">{tn(counts[c.id] || 0, '{n} product', '{n} products')}</div></div>
            <Btn size="sm" variant="ghost" icon="chevron-up" aria-label={t('Move up')} disabled={i === 0} onClick={() => move(i, -1)} />
            <Btn size="sm" variant="ghost" icon="chevron-down" aria-label={t('Move down')} disabled={i === cats.length - 1} onClick={() => move(i, 1)} />
            <Btn size="sm" icon="edit" onClick={() => quickCategory(c)}>{t('Edit')}</Btn>
            <Btn size="sm" variant="ghost" icon="trash" aria-label={t('Delete')} onClick={() => del(c)} />
          </div>
        ))}
        {!cats.length && <Empty icon="tags" title={t('No categories yet')} />}
      </div>
    </div>
  );
}
