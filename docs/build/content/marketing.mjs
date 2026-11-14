import { sec, callout, table, feat, card, hsteps, steps, checklist, ticks, dots, chip, stat, monitor, phone, icon, cover, CONTACT } from '../lib.mjs';

const pages = [];
const P = (secName, html, key, cls = '') => pages.push({ sec: secName, html, cls, key });
const src = (n) => `<sup style="font-family:'JetBrains Mono';font-size:6.6pt;color:var(--navy);font-weight:700">[${n}]</sup>`;
const est = '<span class="chip sun" style="font-size:6.8pt;padding:0 1.6mm">estimate</span>';
const k = (n) => Number(n).toLocaleString('en-US');

/* ---------- numbers used across the document (single source) ---------- */
const WEEKS = [
  // wk, focus, actions, owner, budget, kpi
  [1, 'Ready to sell', 'Check cloud prices. Test the M-Pesa Paybill end to end. Upload the PDFs to agent Resources. Buy the demo till. Print price lists and flyers.', 'MD · Ops', 71900, 'Paybill test paid and recorded; all documents live'],
  [2, 'First agents and pilots', 'Recruit and train 5 agents (1 day: guide, demo, portal). Run 10 pilot trials with friendly shops. Film the first demo videos.', 'Sales lead', 27500, '5 agents approved; 10 pilot trials'],
  [3, 'Field launch, area 1', 'Agents work Ruiru–Juja–Kahawa (Thika Road). Daily 15-minute stand-up. First market-day stand. Content week 1 goes live.', 'Sales lead · Agents', 16000, '200 visits; 50 demos; 15 trials'],
  [4, 'Fix friction', 'Day-28 closes for pilots. Collect two video testimonials. Fix the top 3 setup blockers seen in trials.', 'Ops · Sales lead', 10000, 'Pilot trial → paid ≥ 40%'],
  [5, 'Area 2: Thika town', 'Hardware, agrovets and chemists. Meet 3 wholesalers about introductions. Market-day stand.', 'Sales lead', 16000, '15 trials; 1 wholesaler partner'],
  [6, 'Grow the team', 'Recruit and train 5 more agents. Launch the referral programme. Reprint price lists.', 'Sales lead · MD', 32500, '10 agents; first 5 paying'],
  [7, 'Area 3: Kitengela–Rongai', 'Two chama/SACCO sessions. Market-day stand. Content week 2 repeats with pilot quotes.', 'Sales lead · Agents', 16000, '20 trials in the week'],
  [8, 'Mid-point review', 'Funnel by agent; coach the bottom three. Check the offer and objections log. Second video batch.', 'MD · Sales lead', 19000, 'Trial → paid ≥ 30%'],
  [9, 'Complete Till push', 'Two market activations with a live till at hardware and market clusters. Showcase the KES 69,900 set.', 'Sales lead · Ops', 22000, '5 Complete Tills to date'],
  [10, 'Scale to 15 agents', 'Recruit and train 5 more agents. Pilot two bookkeeper partners who serve SMEs.', 'Sales lead', 33500, '15 agents; 2 bookkeeper partners'],
  [11, 'Upsell', 'Monthly → yearly offer to month-2 clients. Label kit and UPS offers to clients who fit. Market-day stand.', 'Ops · Agents', 16000, '30% of offers accepted'],
  [12, 'Expand accounts', 'Extra till and second-branch offers to the busiest clients. Publish one written case study.', 'Sales lead', 18000, '3 add-on sales'],
  [13, '90-day review', 'KPIs against plan. Decide next quarter: areas, agent count, eTIMS status, restaurant and salon push.', 'MD', 10000, 'Board pack ready'],
];
const BUDGET = [
  ['Demo till (also the swap unit for repairs)', 'Complete Till hardware at cost', 41900],
  ['Printed materials', 'Price lists, A5 flyers, counter stickers; one reprint', 35000],
  ['Agent starter kits × 15', 'T-shirt, ID card, lanyard, price-list holder (2,500 each)', 37500],
  ['Agent training days × 3', 'Venue, tea, printed guides', 15000],
  ['Agent data allowance', 'KES 1,000 a week for each agent’s first 4 weeks', 55000],
  ['Paid social media', 'Facebook, Instagram, TikTok; KES 5,000 a week from week 3', 55000],
  ['Video production', 'Two batches of short demo and testimonial videos', 15000],
  ['Market-day activations × 6', 'Table, banner, power, transport (6,000 each)', 36000],
  ['Referral rewards', 'Free months given (revenue not collected)', 18000],
  ['Contingency', 'About 12% of the total', 41600],
];
const BUDGET_TOTAL = BUDGET.reduce((s, r) => s + r[2], 0);
const WEEK_TOTAL = WEEKS.reduce((s, w) => s + w[4], 0);
if (BUDGET_TOTAL !== 350000 || WEEK_TOTAL + 41600 !== BUDGET_TOTAL) throw new Error(`budget mismatch ${BUDGET_TOTAL} ${WEEK_TOTAL}`);

/* 1 — Cover */
pages.push({ bare: true, cls: 'cover', html: cover({
  kicker: 'For Pentarch management · confidential',
  title: 'Pentarch POS<br><span style="color:var(--sun)">Marketing Strategy</span>',
  tag: 'Who we sell to, how we win, and the first 90 days week by week, with owners, budget and the numbers we track.',
  art: `<div style="position:relative;width:160mm">${monitor('duka-home', '', '132mm')}<div style="position:absolute;right:-2mm;bottom:-4mm;width:34mm">${phone('ag-home')}</div></div>`,
  meta: [['Prepared', '9 November 2026'], ['Horizon', 'Launch + 90 days'], ['Budget', `KES ${k(BUDGET_TOTAL)}`]],
}) });

/* 2 — Summary */
P('Summary', `
${sec('', 'On one page', 'The plan in brief', 'Launch Pentarch POS through a commission agent network in Nairobi and nearby towns, win shops with a free 30-day trial on their own computer, and convert them with fast local setup.')}
<div class="grid g4">
  <div class="card dark">${stat('<span style="color:var(--sun)">55</span>', '<span style="color:#C9D1E3">paying businesses by day 90</span>')}</div>
  ${card(stat('375', 'free trials started in 90 days'))}
  ${card(stat('15', 'agents in the field by week 11'))}
  ${card(stat(`KES ${Math.round(BUDGET_TOTAL / 1000)}k`, '90-day marketing budget'))}
</div>
<div class="grid g-7-5">
  <div class="card">
    <h2>Positioning</h2>
    <p style="color:var(--text);font-size:10.4pt;line-height:1.5">For Kenyan shop owners who lose money they cannot see, <b>Pentarch POS</b> is the till system that runs on their own computer, keeps selling without internet, and shows profit, stock and debts every day. Unlike other low-cost POS systems, the owner can try the full system free for 30 days before paying anything, in English or Kiswahili, with local support.</p>
  </div>
  <div class="card tint">
    <h2>Three priorities</h2>
    ${dots(['<b>Agents first.</b> 15 trained, honest agents working one area a day.', '<b>Trials that start well.</b> First sale within 48 hours, products loaded, staff PINs set.', '<b>Close at day 21–28.</b> Recommend one package; payment by M-Pesa Paybill.'])}
  </div>
</div>
<div class="grid g3">
  ${card(feat('target', 'coral', 'Who first', 'Dukas and minimarts, hardware, agrovets, chemists, wholesale, boutiques. Then salons and restaurants.'))}
  ${card(feat('coins', 'teal', 'The offer', 'KES 1,200/month or 12,000/year after the trial. Complete Till KES 69,900 with a desktop, UPS and all devices.'))}
  ${card(feat('alert', 'sun', 'Biggest risks', 'eTIMS not yet certified; Windows 10 on the bundle PC; a new brand with no references.'))}
</div>
${table(['Result at day 90', 'Target', 'How it is reached'], [
  ['Paying businesses', '<b>55</b>', '10 Complete Till, 15 Software + Setup (5 with Counter Kit), 18 yearly and 12 monthly subscriptions'],
  ['Cash collected', `<b>KES ${k(1271100)}</b> ${est}`, 'Package and subscription payments to the Paybill (hardware cost about KES 497,000)'],
  ['Trial → paid', '<b>30%</b>', 'Of trials that reach day 30 by day 90'],
  ['Monthly recurring revenue', `<b>KES ${k(14400)}</b> + yearly`, '12 monthly payers; 43 yearly or package licences run for 12 months'],
], { cls: 'tight', widths: ['26%', '22%', '52%'] })}
`, 'summary');

/* 3 — Market */
P('01 · Market', `
${sec('01', 'Market and segments', 'Who we sell to, and how many there are')}
<div class="grid g4">
  ${card(stat('7.4 M', `micro, small and medium businesses in Kenya: 1.56 M licensed, 5.85 M unlicensed ${src(1)}`))}
  ${card(stat('~60%', `of MSMEs are in wholesale and retail trade (incl. motor repair) ${src(2)}`))}
  ${card(stat('1.0 M', `Lipa na M-Pesa merchants, plus 2.1 M Pochi la Biashara tills ${src(3)}`))}
  ${card(stat('9,600', `pharmacy facilities on the regulator’s registered list ${src(4)}`))}
</div>
<div class="card tint" style="padding:3mm 4mm"><div class="row" style="gap:2.4mm;flex-wrap:nowrap;align-items:stretch">
  <div style="flex:none;width:30mm"><h3 style="margin:0">Sizing the first market</h3>${est}</div>
  ${[['≈ 900,000', 'licensed firms in trade (1.56 M × ~60%)'], ['≈ 270,000', 'in Nairobi, Kiambu, Machakos, Kajiado (assume 30%)'], ['≈ 40–70,000', 'big enough to need a till (assume 15–25%)'], ['600 paying', 'year-1 goal ≈ 1% of that']].map(([v, d], i) => `${i ? `<span style="align-self:center;color:var(--mute)">${icon('arrow', { size: 14 })}</span>` : ''}<div class="grow"><div class="price" style="font-size:13pt">${v}</div><div class="xs mute" style="line-height:1.3">${d}</div></div>`).join('')}
</div></div>
<h2>Segments, ranked</h2>
${table(['Segment', 'Their pain → what wins them', 'Priority'], [
  ['<b>Dukas, minimarts, supermarkets</b>', 'Cash leakage, no daily profit → fast till, shift close with counted cash, Home screen', chip('Now', 'coral')],
  ['<b>Hardware and building materials</b>', 'Hundreds of items, contractors on credit → units (bag, kg, metre), quotes → invoices, statements', chip('Now', 'coral')],
  ['<b>Agrovets</b>', 'Farmers on credit, expiring chemicals → credit book, batch and expiry', chip('Now', 'coral')],
  ['<b>Chemists</b>', 'Expired stock, strips vs boxes, staff trust → batch and expiry, units, PINs, audit log', chip('Now', 'coral')],
  ['<b>Wholesale and distribution</b>', 'Two price lists, cartons, debtors → wholesale prices, pack barcodes, debtor balances', chip('Now', 'coral')],
  ['<b>Boutiques, cosmetics, electronics</b>', 'No barcodes, sizes, serials → generate EAN-13, labels, variants, IMEI', chip('Now', 'navy')],
  ['<b>Butchery, salon, stationery, spares</b>', 'Weighed items, staff commission, bookings → weight barcodes, commission report, appointments', chip('Second wave', 'navy')],
  ['<b>Restaurants and bars</b>', 'Lost orders, kitchen mix-ups, split bills → tables, kitchen tickets and screen, split bills, takeaway (new; no reference sites yet)', chip('Second wave', 'navy')],
], { cls: 'tight fit', widths: ['30%', '56%', '14%'] })}
${callout('info', 'Compliance pull', `Every business must issue eTIMS invoices; from 1 January 2026 KRA checks expenses against eTIMS data ${src(5)}. KRA’s integrator list (53 firms, 26 Jan 2026) does not include Techlion, Jampos or Loyverse ${src(6)}.`)}
<p class="xs mute" style="line-height:1.45">Sources: [1] KNBS, 2016 MSME Survey Basic Report (knbs.or.ke), as reported by Africa Check. [2] KNBS MSME survey, summarised by Kenyan Wall Street. [3] Safaricom FY26 results, Tech-ish, 7 May 2026. [4] Pharmacy and Poisons Board list of 12 Apr 2024, The Kenya Times (covers retail, wholesale and other facilities). [5] HapaKenya, 23 Jan 2026. [6] KRA, List of approved eTIMS third-party integrators as at 26 Jan 2026.</p>
`, 'market');

/* 4 — Competitors */
const dotc = (x, y, label, c, big = false, sub = '') => `<div style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:.6mm;z-index:2"><span style="width:${big ? 7 : 4.6}mm;height:${big ? 7 : 4.6}mm;border-radius:50%;background:${c};box-shadow:0 0 0 2px #fff"></span><span style="font:700 ${big ? 9.4 : 8.2}pt 'DM Sans';color:var(--text);white-space:nowrap;background:rgba(255,255,255,.85);padding:0 1mm;border-radius:3px">${label}</span>${sub ? `<span class="xs mute" style="white-space:nowrap;margin-top:-.6mm">${sub}</span>` : ''}</div>`;
P('02 · Competitors', `
${sec('02', 'Competitors', 'Where we sit', 'Published prices and features, checked 9 November 2026. The map is our judgement of each product’s Kenyan fit, not a measurement.')}
<div class="grid g-5-7" style="align-items:stretch">
  <div class="card" style="padding:3mm">
    <div style="position:relative;height:96mm;margin:2mm 2mm 7mm 8mm;border-left:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink);background:linear-gradient(var(--teal-t),var(--teal-t)) right top/50% 50% no-repeat">
      <div style="position:absolute;right:1mm;top:1mm;color:var(--teal-d);font-weight:700" class="xs">Best place to be</div>
      ${dotc(82, 15, 'Pentarch POS', 'var(--coral)', true, 'free 30-day trial')}
      ${dotc(68, 30, 'Techlion', 'var(--ink)')}
      ${dotc(40, 34, 'Uzapoint', 'var(--ink)', false, 'quote only')}
      ${dotc(62, 52, 'Jampos', 'var(--ink)')}
      ${dotc(45, 58, 'Nexa', 'var(--ink)')}
      ${dotc(30, 62, 'SimbaPOS', 'var(--ink)')}
      ${dotc(85, 80, 'Loyverse', 'var(--ink)')}
      ${dotc(16, 78, 'Odoo', 'var(--ink)')}
      <div style="position:absolute;left:50%;bottom:-6.5mm;transform:translateX(-50%);white-space:nowrap" class="xs"><b>Lower cost to start →</b></div>
      <div style="position:absolute;left:-7mm;top:50%;transform:translate(-50%,-50%) rotate(-90deg);white-space:nowrap" class="xs"><b>Kenyan fit →</b></div>
    </div>
    <p class="xs mute">Kenyan fit = offline selling, M-Pesa, Kiswahili, local setup and support.</p>
  </div>
  ${table(['Product', 'Published price', 'Notes'], [
    ['<b>Techlion</b>', 'KES 1,200/month, 12,000/year, or 35,000 one-off', 'Offline + sync, M-Pesa STK push, on-site install. Trial length not stated.'],
    ['<b>Uzapoint</b>', 'Quote only', 'Says eTIMS is live; till/paybill reconciliation; hardware bundles.'],
    ['<b>Jampos</b>', 'USD 9.5–49.5/month', 'Free M-Pesa integration; free offline desktop till.'],
    ['<b>Nexa POS</b>', 'KES 9,500–25,000 licence; bundles 45,000–75,000 without a computer', 'Free Nairobi installation.'],
    ['<b>SimbaPOS</b>', 'From USD 249 per user, one-off', 'Restaurant strength; M-Pesa.'],
    ['<b>Loyverse</b>', 'Free core; add-ons USD 7–25/month', 'No native M-Pesa or eTIMS.'],
    ['<b>Odoo POS</b>', 'USD 8.95–17/user/month + implementation', 'Full ERP; eTIMS via approved partners.'],
  ], { cls: 'tight fit', widths: ['18%', '38%', '44%'] })}
</div>
<div class="grid g2">
  <div class="card" style="border-top:3px solid var(--teal)">
    <h2 style="color:var(--teal-d)">Where we are stronger</h2>
    ${ticks([
      '<b>30-day free trial</b> on the shop’s own computer',
      '<b>Live online demo</b>: 18 business types, Kenyan products',
      '<b>Fully offline</b> selling; English and Kiswahili',
      '<b>Credit book</b>, WhatsApp statements, <b>barcode labels</b>',
      '<b>Cash control</b>: PINs, shift close, audit log, theft report',
      '<b>Stock, purchases, 24 reports</b>; restaurant, salon, quotes and invoices',
      '<b>Complete Till KES 69,900</b> incl. computer and UPS (Nexa: 45,000–60,000 without a computer)',
    ])}
  </div>
  <div class="card" style="border-top:3px solid var(--coral)">
    <h2 style="color:var(--coral-d)">Honest weaknesses</h2>
    ${ticks([
      '<b>Not eTIMS-certified yet</b>; receipts carry PIN and tax codes only',
      '<b>New brand</b>, no reviews or reference clients',
      '<b>Restaurant and salon modules are new</b>: no reference sites yet',
      '<b>STK push</b> needs each shop’s own Safaricom go-live',
      '<b>Bundle PC on Windows 10</b>: no more free security updates',
      '<b>Refurbished hardware</b>; support Mon–Sat 8–6 (Techlion: 24/7)',
    ], 'cross')}
  </div>
</div>
`, 'competitors');

/* 5 — Offer & pricing */
P('03 · Offer and pricing', `
${sec('03', 'Offer and pricing', 'What we sell, and what each sale earns', 'Prices are final (pricing decision of 9 November 2026). Margins below are before Pentarch staff time and overheads.')}
${table(['Offer', 'Client pays (KES)', 'Our direct cost (KES)', 'Agent commission', 'Notes'], [
  ['<b>Free trial</b>', '0', 'Setup help, support time', '—', '30 days, full system, client’s own computer'],
  ['<b>Subscription</b>', '1,200 / month or 12,000 / year', 'Hosting and support', '20% of payments for 12 months', 'Yearly = 2 months free. Extra branch +1,000 / month'],
  ['<b>Software + Setup</b>', '15,000 (or 3,500 + 1,200 / month)', 'Setup visit or remote session', '1,500', 'Includes 12 months software and 300 products loaded'],
  ['<b>Complete Till</b>', '69,900', '41,900 hardware', '3,000', 'Hardware margin ≈ 11,000 after 5,000 setup and 12,000 software value'],
  ['<b>Counter Kit</b>', '21,900', '15,600 hardware', '1,000', 'Scanner, printer, drawer, 10 rolls, installed'],
  ['<b>Extra till</b>', '44,900', '28,800 hardware', '—', 'Same branch; add an Extra UPS (8,500) where power is poor'],
  ['<b>Label kit · UPS · paper</b>', '16,500 · 8,500 · 7,000', 'Market price', '—', 'Upsell after day 30'],
], { cls: 'tight', widths: ['16%', '20%', '17%', '16%', '31%'] })}
<div class="grid g3">
  ${card(feat('handshake', 'coral', 'Why a free trial', 'It removes the owner’s risk, and agents can start a client with no hardware.'))}
  ${card(feat('minipc', 'navy', 'Why a desktop', 'Cheapest reliable computer; with a UPS it beats a laptop on cost and theft risk.'))}
  ${card(feat('ban', 'sun', 'No discounting', 'We match Techlion’s price and add value. The yearly plan is the only deal.'))}
</div>
<h2>Unit economics, base case ${est}</h2>
<div class="grid g4">
  ${card(stat('KES 8,300', 'cost to win one paying business (marketing + commissions ÷ 55)', 'sm'))}
  ${card(stat('KES 12,000', 'year-1 software revenue per subscriber', 'sm'))}
  ${card(stat('KES 11,000', 'hardware margin per Complete Till', 'sm'))}
  ${card(stat('≈ 7 months', 'payback on a monthly subscriber; yearly and package clients pay at once', 'sm'))}
</div>
${callout('info', 'Prices in the system', 'Cloud settings, the agent portal and the app use Complete Till 69,900, Counter Kit 21,900 and Extra till 44,900 (app 1.1, checked 9 November 2026). Confirm the Paybill number before any agent goes to the field.')}
`, 'offer');

/* 6 — Channels */
const ch = (ic, c, name, role, how, cost, target) => `<div class="card" style="display:grid;grid-template-columns:9mm 1fr;gap:3mm;padding:3mm 3.6mm"><span class="ibox ${c}">${icon(ic, { size: 16 })}</span><div><div class="row" style="justify-content:space-between;align-items:baseline"><h3 style="margin:0">${name}</h3><span class="xs mute nowrap">${role}</span></div><p class="small" style="margin-top:.6mm">${how}</p><p class="xs" style="margin-top:1mm"><b>Cost:</b> ${cost} · <b>90-day target:</b> ${target}</p></div></div>`;
P('04 · Channels', `
${sec('04', 'Channels', 'How we reach shop owners', 'Face to face sells a till. Every other channel exists to make the agent’s visit warmer, or to bring trials to the agent.')}
<div class="grid g2">
  ${ch('users', 'coral', 'Commission agents', 'Primary · 70% of trials', 'One area a day, demo on the phone, trial started on the spot. Trained on the Sales Agent Guide; paid only on cleared payments.', 'commission + kits and data', '15 agents; 300 trials')}
  ${ch('handshake', 'teal', 'Client referrals', 'Second · 10%', 'Ask at handover and day 30. Referrer gets a free month when the new shop pays. Leads go to the referrer’s agent.', 'one month per paying referral', '15 paying referrals')}
  ${ch('chat', 'navy', 'WhatsApp and video', 'Support · 10%', 'Short screen videos and Kiswahili Status posts with the demo link. Agents share in groups they belong to; no spam.', 'KES 5,000 / week ads', '60 trials from the demo link')}
  ${ch('globe', 'sun', 'Website and live demo', 'Always on', 'pentarchcommunications.com/systems/pos/ with the demo, the free-trial link (/pos/?trial=1) and a booking form. Bookings are assigned to an agent within one working day.', 'existing site', '40 demo bookings')}
  ${ch('truck', 'coral', 'Wholesalers and distributors', 'Partner', 'A wholesaler introduces its retailers; we demo at the collection point. Offer the wholesaler a free till licence for a year after 10 paying referrals.', 'licence value', '2 partners; 15 trials')}
  ${ch('book', 'navy', 'Bookkeepers', 'Partner · test', 'People who already keep SME books recommend a till that gives clean daily figures. Same referral reward.', 'referral reward', '2 partners')}
  ${ch('building', 'teal', 'Market days and chamas', 'Event', 'A live till on a table at a busy market or a chama meeting. Book demos on the spot.', 'KES 6,000 per day', '6 events; 30 trials')}
  ${ch('tag', 'sun', 'Jiji listing', 'Test', 'List the Complete Till under POS systems with the price and the demo link. Many owners already shop for hardware there.', 'free listing', 'measure enquiries')}
</div>
${callout('dark', 'One message everywhere', '<b>“Know your profit every evening. Try it free for 30 days.”</b> · <i>“Jua faida yako kila jioni. Jaribu bure kwa siku 30.”</i> Every post, flyer and video ends with the demo link and the WhatsApp number ' + CONTACT.phone + '.', 'megaphone')}
`, 'channels');

/* 7 — 90-day plan */
P('05 · 90-day plan', `
${sec('05', 'Launch plan', 'The first 90 days, week by week', 'Owners: MD = managing director · Sales lead = agent manager · Ops = installation and support · Agents. Budgets in KES.')}
${table(['Wk', 'Focus', 'Main actions', 'Owner', 'Budget', 'KPI by end of week'], WEEKS.map(([w, f, a, o, b, kpi]) => [`<b class="mono">${w}</b>`, `<b>${f}</b>`, a, o, `<span class="mono">${k(b)}</span>`, kpi]).concat([{ cls: 'total', cells: ['', 'Total', 'Plus contingency KES 41,600 held by the MD', '', `<span class="mono">${k(WEEK_TOTAL)}</span>`, ''] }]), { cls: 'tight fit', align: ['c', '', '', '', 'r', ''], widths: ['5%', '15%', '42%', '12%', '8%', '18%'] })}
`, 'plan');

/* 8 — Funnel & budget */
const fb = (w, bg, v, l, note) => `<div style="display:flex;align-items:center;gap:3mm"><div class="fbar" style="width:${w}%;background:${bg}"><span>${l}</span><span class="fv">${v}</span></div><span class="xs mute">${note}</span></div>`;
P('06 · Funnel and budget', `
${sec('06', 'Funnel targets and budget', 'What 90 days should produce', 'Base case assumes agents reach half of the guide’s full-time targets on average, because many work part time.')}
<div class="grid g-7-5">
  <div class="card">
    <h2>90-day funnel ${est}</h2>
    <div class="stack" style="gap:1.8mm;margin-top:2mm">
      ${fb(100, 'var(--ink)', '4,200', 'Shop visits', '')}
      ${fb(80, 'var(--navy)', '1,050', 'Demos', '25% of visits')}
      ${fb(60, 'var(--coral-d)', '375', 'Trials', '315 agents · 60 web and referral')}
      ${fb(48, 'var(--sun-d)', '190', 'Day 30', 'started by week 9')}
      ${fb(40, 'var(--teal-d)', '55', 'Paying', '30% of day-30 trials')}
    </div>
    <p class="xs mute" style="margin-top:2.4mm">Per agent-week in the field (105 agent-weeks): 40 visits, 10 demos, 3 trials. The guide’s full-time target is 100 visits, 30 demos, 10 trials.</p>
  </div>
  <div class="stack">
    ${table(['Ramp', 'Agents in field'], [['Weeks 3–6', '5'], ['Weeks 7–10', '10'], ['Weeks 11–13', '15']], { cls: 'tight', align: ['', 'r'] })}
    ${table(['Paying mix by day 90', 'No.'], [['Complete Till', '10'], ['Software + Setup (5 with Counter Kit)', '15'], ['Yearly subscription', '18'], ['Monthly subscription', '12'], { cls: 'total', cells: ['Total', '55'] }], { cls: 'tight', align: ['', 'r'] })}
  </div>
</div>
<h2>Budget: KES ${k(BUDGET_TOTAL)} for 90 days</h2>
${table(['Line', 'What it buys', 'KES'], BUDGET.map(([a, b, c]) => [`<b>${a}</b>`, b, `<span class="mono">${k(c)}</span>`]).concat([{ cls: 'total', cells: ['Total', 'Agent commissions are paid from client payments and are not in this budget (about KES 105,000 on the base case).', `<span class="mono">${k(BUDGET_TOTAL)}</span>`] }]), { cls: 'tight', align: ['', '', 'r'], widths: ['30%', '56%', '14%'] })}
`, 'funnel');

/* 9 — Content calendar */
P('07 · Content calendar', `
${sec('07', 'Content calendar', 'Four weeks of posts', 'Facebook, Instagram and TikTok on Mon/Wed/Fri; WhatsApp Status every day (agents re-share). Every post ends with the demo link. Real client names and faces only with written permission.')}
${table(['Week · theme', 'Monday · video', 'Wednesday · picture post', 'Friday · offer', 'WhatsApp Status (Kiswahili)'], [
  ['<b>1 · Know your profit</b>', '30-second screen video: a sale, then the Home screen at closing time', '“Three numbers every duka owner should know each evening”', 'Try the live demo; 30 days free', '“Jua faida yako kila jioni. Jaribu bure siku 30.”'],
  ['<b>2 · Stop the leaks</b>', 'Shift close: expected cash vs counted cash', 'Every staff member has a PIN; every discount is recorded', 'A pilot owner’s quote (with permission)', '“Kila mhudumu ana PIN yake. Kila punguzo linarekodiwa.”'],
  ['<b>3 · Deni book</b>', 'Credit sale and a WhatsApp statement', 'Hardware and agrovet example: contractors and farmers on credit', 'Counter Kit for shops with a computer: KES 21,900', '“Madeni yote mahali pamoja. Tuma statement kwa WhatsApp.”'],
  ['<b>4 · No internet, no problem</b>', 'Phone data off, the sale still goes through', 'Generate a barcode and print labels for loose stock', 'Complete Till KES 69,900: desktop, UPS, all devices, setup', '“Inauza hata bila internet.”'],
], { cls: 'tight', widths: ['15%', '22%', '23%', '19%', '21%'] })}
<div class="grid g3">
  ${card(`<h3>${icon('video', { size: 15, color: 'var(--coral-d)' })} Video rules</h3>${dots(['Real screens from the live demo', 'Under 45 seconds, captions on', 'One idea per video', 'No hype words, no music with lyrics'])}`)}
  ${card(`<h3>${icon('chat', { size: 15, color: 'var(--navy)' })} Kiswahili first on Status</h3>${dots(['Short Kiswahili line on the picture', 'English in the caption', 'Agents post from their own phones', 'Demo link carries the agent code'])}`)}
  ${card(`<h3>${icon('bars', { size: 15, color: 'var(--teal-d)' })} Measure</h3>${dots(['Demo link opens per post', 'Trials from the demo link', 'Bookings from the website form', 'Keep what works, drop the rest after week 4'])}`)}
</div>
${callout('info', 'Who makes it', 'The Pentarch design team films and edits on Monday for the week. Agents send one photo or short clip from the field each week (with the owner’s permission). Ops checks every claim against the live demo before posting.')}
`, 'content');

/* 10 — Referral, retention, upsell */
P('08 · Referrals and retention', `
${sec('08', 'Referrals, retention and upsell', 'Keep every client, and grow the account', 'A paying shop that stays three years is worth more than three new trials. Retention starts at handover.')}
<div class="grid g2" style="align-items:start">
  <div class="stack" style="gap:3.4mm">
  <div class="card" style="border-top:3px solid var(--teal)">
    <h2>Referral programme <span class="chip sun" style="vertical-align:middle">proposed</span></h2>
    ${steps([{ t: 'Refer', d: 'A client sends a friend’s name or shares the demo link.' }, { t: 'Trial', d: 'The friend gets the normal 30-day trial and a priority setup visit.' }, { t: 'Reward', d: 'When the friend pays, the referrer gets one free month (up to 12 a year).', c: 't' }])}
    <p class="xs mute">The referrer’s agent gets the lead and the normal commission. Ops adds the free month by extending the licence. MD approval needed before week 6.</p>
  </div>
    <div class="card">
      <h2>Act the same week if…</h2>
      ${ticks(['no sync for 7 days', 'no sales for 3 days', 'the licence ends within 7 days', 'fewer than 50 products after week 1', 'two support calls about one problem'], 'cross')}
    </div>
  </div>
  <div class="card">
    <h2>Client journey after the sale</h2>
    ${table(['When', 'What happens', 'Who'], [
      ['Day 0', 'Handover checklist signed; support number saved', 'Installer + agent'],
      ['Day 7', 'WhatsApp check: “Are all staff using their PINs?”', 'Agent'],
      ['Day 45', 'Call: review the Home screen together; fix blockers', 'Ops'],
      ['Month 2', 'Monthly payers offered the yearly plan', 'Agent'],
      ['Monthly', 'One short tip by WhatsApp (EN + SW)', 'Ops'],
      ['Before renewal', 'Reminders at 30, 7 and 1 days, with Paybill and code', 'Ops'],
    ], { cls: 'tight', widths: ['24%', '54%', '22%'] })}
  </div>
</div>
<h2>Upsell triggers</h2>
${table(['When the shop has…', 'Offer', 'When the shop has…', 'Offer'], [
  ['many items without barcodes', '<b>Label kit</b> · 16,500', 'its own desktop and power cuts', '<b>UPS</b> · 8,500'],
  ['queues at peak hours', '<b>Extra till</b> · 44,900', 'been happy on monthly for 2 months', '<b>Yearly plan</b> · 12,000'],
  ['a second shop', '<b>Extra branch</b> · +1,000 / month', 'a computer but no devices', '<b>Counter Kit</b> · 21,900'],
], { cls: 'tight', widths: ['27%', '23%', '27%', '23%'] })}
${callout('tip', 'News that keeps clients', 'At the day-45 call, show what app 1.1 added: stock counts, receiving, profit and loss, the theft report, quotes. Announce eTIMS only once KRA certifies it. Reasons to stay, and to move to yearly.')}
`, 'retention');

/* 11 — Risks & metrics */
const lv = (t) => chip(t, t === 'High' ? 'coral' : t === 'Medium' ? 'sun' : 'teal');
P('09 · Risks and metrics', `
${sec('09', 'Risks and weekly metrics', 'What could go wrong, and what we watch', 'Reviewed every Monday by the MD and the sales lead, using the admin dashboard and the agent portal.')}
${table(['Risk', 'Likelihood', 'Impact', 'Mitigation', 'Owner'], [
  ['eTIMS certification takes long; shops that need it walk away', lv('High'), lv('High'), 'Honest script; client keeps its current eTIMS method; pursue KRA certification or a listed integrator partner', 'MD'],
  ['Windows 10 on the bundle PC loses support (no more security updates; Chrome support may end later)', lv('Medium'), lv('Medium'), 'Till used for selling only; offer the G4 Mini (Windows 11) upgrade; watch Google and Microsoft notices', 'Ops'],
  ['Refurbished hardware fails in the first months', lv('Medium'), lv('Medium'), 'Buying rule and tests; supplier warranty; demo till doubles as a swap unit', 'Ops'],
  ['Agent over-promises or takes cash', lv('Medium'), lv('High'), 'Code of conduct; Paybill only; call 1 in 10 new clients to check what they were told', 'Sales lead'],
  ['Trials start but are not used', lv('High'), lv('High'), 'Day 1 and day 3 visits; load products for them; track first sale within 48 hours', 'Sales lead'],
  ['New restaurant and salon modules have no reference clients', lv('Medium'), lv('Medium'), 'Pilot with 3 restaurants and 3 salons first; two video testimonials before pushing these segments', 'Sales lead'],
  ['Support overload as clients grow', lv('Medium'), lv('Medium'), 'WhatsApp templates and FAQ; second support person at 150 paying clients', 'MD'],
  ['Payments recorded by hand get missed', lv('Low'), lv('Medium'), 'Daily Paybill reconciliation; set up Daraja for automatic licence payments', 'Ops'],
], { cls: 'tight fit', align: ['', 'c', 'c', '', ''], widths: ['30%', '10%', '9%', '40%', '11%'] })}
<h2>Weekly metrics</h2>
${table(['Metric', 'Where it comes from', 'Target per week (weeks 7–13)'], [
  ['Visits logged · demos · trials started', 'Agent portal leads and activities', '400 · 100 · 30'],
  ['Trials with a first sale within 48 hours', 'Admin: businesses, usage', '70% or more'],
  ['Trials ending in 7 days · follow-ups overdue', 'Admin dashboard · portal', 'Every one contacted'],
  ['New paying businesses · trial → paid', 'Admin: payments', '6 or more · 30%'],
  ['MRR and cash collected', 'Admin dashboard and payments', 'Up every week'],
  ['Active agents (5+ visits logged)', 'Admin: agents', 'All recruited agents'],
  ['Sync health: paying shops synced in the last 7 days', 'Admin: last sync', '95% or more'],
  ['Support requests per paying shop', 'Support WhatsApp log', 'Fewer than 0.5'],
], { cls: 'tight', widths: ['40%', '32%', '28%'] })}
`, 'risks');

export default { title: 'Pentarch POS — Marketing Strategy', short: 'Pentarch POS · Marketing Strategy', pages };
