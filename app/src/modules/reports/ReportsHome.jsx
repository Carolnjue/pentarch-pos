// Reports catalogue: grouped cards, a finder, and one-tap shortcuts for the questions owners ask most.
import { useState } from 'preact/hooks';
import { REPORTS, GROUPS } from './defs.jsx';
import { PageHeader, Icon, SearchBox, Empty } from '../../ui/kit.jsx';
import { can } from '../../auth/permissions.js';
import { norm } from '../../lib/search.js';
import { t } from '../../i18n/index.js';

const QUICK = [
  { href: '/reports/sales?preset=today', icon: 'receipt', label: 'Sales today', perm: 'reports.view' },
  { href: '/reports/pnl?preset=month', icon: 'bars', label: 'Profit this month', perm: 'reports.pnl' },
  { href: '/reports/low-stock', icon: 'alert', label: 'What to reorder', perm: 'reports.stock' },
  { href: '/reports/aging', icon: 'credit', label: 'Who owes me', perm: 'reports.view' },
  { href: '/reports/exceptions?preset=month', icon: 'shield', label: 'Voids & discounts this month', perm: 'reports.exceptions' }
];

export default function ReportsHome() {
  const [q, setQ] = useState('');
  const n = norm(q);
  const mine = REPORTS.filter((r) => can(r.perm) && (!n || norm(t(r.title) + ' ' + t(r.desc) + ' ' + r.title + ' ' + r.desc).includes(n)));
  const quick = QUICK.filter((x) => can(x.perm));
  return (
    <div class="page rpt-home">
      <PageHeader title={t('Reports')} sub={t('Every number in your business, in plain words. Print or export any report.')} actions={<SearchBox value={q} onValue={setQ} placeholder={t('Find a report')} />} />
      {!q && quick.length > 0 && (
        <div class="rpt-quick mb">
          {quick.map((x) => <a href={'#' + x.href} class="rq"><span class="ico-bub"><Icon name={x.icon} size={18} /></span><b>{t(x.label)}</b><Icon name="chevron-right" size={16} /></a>)}
        </div>
      )}
      {GROUPS().map((g) => {
        const list = mine.filter((r) => r.group === g.id);
        if (!list.length) return null;
        return (
          <section class="rpt-group">
            <h2><Icon name={g.icon} size={18} />{g.label}</h2>
            <div class="rpt-cards">
              {list.map((r) => (
                <a class="card rpt-card" href={'#/reports/' + r.id} data-report={r.id}>
                  <span class="ico-bub"><Icon name={r.icon} size={20} /></span>
                  <span class="grow"><b>{t(r.title)}</b><small>{t(r.desc)}</small></span>
                  <Icon name="chevron-right" size={18} />
                </a>
              ))}
            </div>
          </section>
        );
      })}
      {!mine.length && <div class="card"><Empty icon="search" title={q ? t('No report matches “{q}”', { q }) : t('No reports for your role')} text={q ? t('Try another word, for example “stock”, “VAT” or “profit”.') : t('Ask the owner to give your role access in Settings → Staff & roles.')} /></div>}
    </div>
  );
}
