// "No products yet" — shown on Sell and Products for a new business. One tap loads typical products for the business type.
import { useState } from 'preact/hooks';
import { Btn, Icon } from '../../ui/kit.jsx';
import { toast } from '../../ui/overlay.jsx';
import { can } from '../../auth/permissions.js';
import { typeById } from '../../presets/types.js';
import { navigate } from '../../router.js';
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export function StartCatalog() {
  const [busy, setBusy] = useState(false);
  const tp = typeById(S.business.value?.type || 'other');
  const typeName = t(tp.label);
  if (!can('products.edit')) {
    return (
      <div class="start-cat">
        <div class="art"><Icon name="box" size={30} /></div>
        <h3>{t('No products yet')}</h3>
        <p>{t('Ask the owner or a manager to add products. You can still sell items they add on any device.')}</p>
      </div>
    );
  }
  const load = async () => {
    setBusy(true);
    try {
      const { addTemplateCatalogue } = await import('../../presets/seed.js');
      const n = await addTemplateCatalogue(S.business.value?.type || 'other');
      toast(t('{n} products added. Change prices any time in Products.', { n }), { icon: 'check', ms: 5000 });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div class="start-cat">
      <div class="art" style={{ background: tp.color, color: '#fff' }}><Icon name={tp.icon} size={30} /></div>
      <h3>{t('Your shop has no products yet')}</h3>
      <p>{t('Start in one tap with typical {type} products and prices. You can change prices and remove what you do not sell.', { type: typeName.toLowerCase() })}</p>
      <div class="row wrap gap-s" style={{ justifyContent: 'center' }}>
        <Btn variant="primary" icon="layers" onClick={load} disabled={busy}>{busy ? t('Adding…') : t('Add typical products')}</Btn>
        <Btn icon="plus" onClick={() => navigate('/products/new')}>{t('Add one product')}</Btn>
        {can('products.import') && <Btn icon="upload" onClick={() => navigate('/products/import')}>{t('Import from Excel / CSV')}</Btn>}
      </div>
      <p class="small mute" style={{ marginTop: '4px' }}>{t('Have a barcode scanner? Scan an item on the Sell screen and tap “Add product”.')}</p>
    </div>
  );
}
