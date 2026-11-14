// Quotes & invoices module (wholesale, hardware, auto spares…): quotes → A4 / WhatsApp → invoice (credit sale) or sale,
// invoices with payment terms, M-Pesa and bank details, delivery notes, status tracking, payments via customer accounts.
import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
import { on } from '../../lib/bus.js';
import * as S from '../../state.js';
import { db } from '../../db/index.js';
import { save } from '../../db/repo.js';
import { demoSeed } from './seed.js';

const QuotesPage = lazy(() => import('./QuotesPage.jsx'));
const QuoteEditor = lazy(() => import('./QuoteEditor.jsx'));
const FRONT = ['owner', 'manager', 'cashier'];

// a quote loaded into the Sell cart is marked sold when that sale completes
on('sale', async (sale) => {
  if (!sale.quote_id || sale.doc_type === 'invoice') return;
  const q = await db().quotes.get(sale.quote_id);
  if (q && !['invoiced', 'sold'].includes(q.status)) await save('quotes', { ...q, status: 'sold', sold_at: Date.now(), sale_id: sale.id, invoice_no: sale.no });
});

// fetch this module's pages in the background so they also open offline on a freshly installed till
let preloaded = false;
on('route', () => {
  if (preloaded || !(S.business.value?.modules?.quotes)) return;
  preloaded = true;
  (window.requestIdleCallback || setTimeout)(() => { QuotesPage.preload(); QuoteEditor.preload(); });
});

export default {
  id: 'quotes',
  enabled: (biz) => !!biz.modules?.quotes,
  permissions: [
    { key: 'quotes.use', label: 'Make & send quotes', group: 'Quotes & invoices', roles: FRONT },
    { key: 'invoices.create', label: 'Create invoices (sell on account)', group: 'Quotes & invoices', roles: FRONT },
    { key: 'invoices.view', label: 'View quotes & invoices', group: 'Quotes & invoices', roles: [...FRONT, 'accountant'] }
  ],
  routes: [
    { path: '/quotes', component: QuotesPage, perm: 'invoices.view', title: 'Quotes & invoices' },
    { path: '/quotes/:id', component: QuoteEditor, perm: 'invoices.view', title: 'Quote' }
  ],
  nav: [{ path: '/quotes', label: 'Quotes & invoices', icon: 'file', order: 16, perm: 'invoices.view' }],
  settings: [{ id: 'quotes', label: 'Quotes & invoices', icon: 'file', order: 9, component: lazy(() => import('./Settings.jsx')), perm: 'settings.view' }],
  commands: [
    { id: 'q.new', label: 'New quote', icon: 'file', run: () => navigate('/quotes/new'), perm: 'quotes.use', keywords: 'quotation nukuu bei estimate proforma' },
    { id: 'q.inv', label: 'New invoice', icon: 'receipt', run: () => navigate('/quotes/new?invoice=1'), perm: 'invoices.create', keywords: 'invoice ankara credit lpo' },
    { id: 'q.list', label: 'Invoices — who has not paid', icon: 'credit', run: () => navigate('/quotes?tab=invoices'), perm: 'invoices.view', keywords: 'overdue unpaid debt invoices' }
  ],
  demoSeed
};
