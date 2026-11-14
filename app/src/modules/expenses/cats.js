// Expense categories: built-in (stable ids, translated labels) + the owner's custom ones (business.settings.expense_categories).
import * as S from '../../state.js';
import { t } from '../../i18n/index.js';

export const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Rent', icon: 'store' },
  { id: 'salaries', label: 'Salaries & wages', icon: 'users' },
  { id: 'transport', label: 'Transport', icon: 'truck' },
  { id: 'utilities', label: 'Electricity & water', icon: 'zap' },
  { id: 'supplies', label: 'Shop supplies', icon: 'bag' },
  { id: 'airtime', label: 'Airtime & internet', icon: 'phone' },
  { id: 'repairs', label: 'Repairs & maintenance', icon: 'wrench' },
  { id: 'other', label: 'Other', icon: 'more' }
];
/** Custom categories: [{id:'c_xxx', name}] (hidden ones keep their id so old expenses still show a name). */
export const customCats = () => (S.business.value?.settings?.expense_categories || []).filter((c) => c && c.id);
export const allCats = () => [
  ...EXPENSE_CATEGORIES.slice(0, -1).map((c) => ({ ...c, name: t(c.label) })),
  ...customCats().filter((c) => !c.hidden).map((c) => ({ id: c.id, name: c.name, icon: 'tag', custom: true })),
  { ...EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1], name: t('Other') }
];
export function expenseCatLabel(id) {
  const b = EXPENSE_CATEGORIES.find((c) => c.id === id);
  if (b) return t(b.label);
  return customCats().find((c) => c.id === id)?.name || id || t('Other');
}
export const expenseCatIcon = (id) => EXPENSE_CATEGORIES.find((c) => c.id === id)?.icon || 'tag';
