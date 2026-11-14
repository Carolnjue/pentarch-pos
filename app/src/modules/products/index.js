import { lazy } from '../../lib/lazy.jsx';
import { navigate } from '../../router.js';
const ProductsPage = lazy(() => import('./ProductsPage.jsx'));
const ProductForm = lazy(() => import('./ProductForm.jsx'));
const Categories = lazy(() => import('./Categories.jsx'));
const Labels = lazy(() => import('./Labels.jsx'));
const Import = lazy(() => import('./Import.jsx'));
const ALLV = ['owner', 'manager', 'cashier', 'stock', 'accountant'];
export default {
  id: 'products',
  permissions: [
    { key: 'products.view', label: 'View products & stock', group: 'Products', roles: ALLV },
    { key: 'products.edit', label: 'Add & edit products', group: 'Products', roles: ['owner', 'manager', 'stock'] },
    { key: 'products.price', label: 'Change product prices', group: 'Products', roles: ['owner', 'manager'] },
    { key: 'products.delete', label: 'Delete products', group: 'Products', roles: ['owner', 'manager'] },
    { key: 'products.import', label: 'Import / export products', group: 'Products', roles: ['owner', 'manager', 'stock'] },
    { key: 'products.cost_view', label: 'See cost prices & profit', group: 'Products', roles: ['owner', 'manager', 'accountant'] },
    { key: 'labels.print', label: 'Print barcode labels', group: 'Products', roles: ['owner', 'manager', 'stock', 'cashier'] }
  ],
  routes: [
    { path: '/products', component: ProductsPage, perm: 'products.view', title: 'Products' },
    { path: '/products/new', component: ProductForm, perm: 'products.edit', title: 'New product' },
    { path: '/products/categories', component: Categories, perm: 'products.edit', title: 'Categories' },
    { path: '/products/labels', component: Labels, perm: 'labels.print', title: 'Print labels' },
    { path: '/products/import', component: Import, perm: 'products.import', title: 'Import products' },
    { path: '/products/:id', component: ProductForm, perm: 'products.view', title: 'Product' }
  ],
  nav: [{ path: '/products', label: 'Products', icon: 'box', order: 20, perm: 'products.view' }],
  commands: [
    { id: 'p.new', label: 'Add product', icon: 'plus', run: () => navigate('/products/new'), keywords: 'new item bidhaa', perm: 'products.edit' },
    { id: 'p.labels', label: 'Print barcode labels', icon: 'barcode', run: () => navigate('/products/labels'), keywords: 'sticker price tag', perm: 'labels.print' },
    { id: 'p.import', label: 'Import products from CSV / Excel', icon: 'upload', run: () => navigate('/products/import'), perm: 'products.import' },
    { id: 'p.cats', label: 'Manage categories', icon: 'tags', run: () => navigate('/products/categories'), perm: 'products.edit' }
  ],
  shortcuts: [{ keys: 'Scan', label: 'Scan a barcode on the Products page to open that product', scope: 'Products' }]
};
