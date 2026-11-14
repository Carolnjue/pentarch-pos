import { mk, phoneA, shotC, qs, sec, callout, table, feat, card, steps, hsteps, checklist, ticks, dots, chip, stat, monitor, phone, shot, icon, cover, mark, CONTACT, kes } from '../lib.mjs';

const pages = [];
const P = (secName, html, key, cls = '') => pages.push({ sec: secName, html, cls, key });

/* 1 — Cover */
pages.push({ bare: true, cls: 'cover', html: cover({
  kicker: 'Field manual · Commission agents',
  title: 'Pentarch POS<br><span style="color:var(--sun)">Sales Agent Guide</span>',
  tag: 'Who to visit, what to say, how to demo, how to start a free trial and how you get paid. Everything you need in the field, in one place.',
  art: `<div style="position:relative;width:160mm">${monitor('duka-sell', '', '132mm')}<div style="position:absolute;right:-2mm;bottom:-4mm;width:36mm">${phone('ag-home')}</div></div>`,
  meta: [['For', 'Pentarch POS sales agents'], ['Edition', '2 · November 2026 · app 1.1'], ['Support', CONTACT.phone]],
}) });

/* 2 — Contents */
const toc = [
  ['★', 'Your first day: quick start', 'quick'],
  ['01', 'The product in one line', 'product'], ['02', 'Who to target', 'target'], ['03', 'Where to find them', 'where'], ['04', 'Your day and your targets', 'day'],
  ['05', 'The 60-second pitch', 'pitch'], ['06', 'Discovery questions', 'discovery'], ['07', 'The 10-minute demo', 'demo'], ['07', 'Demo scripts by business type', 'demo3'], ['08', 'Handling objections', 'objections'],
  ['09', 'Packages and prices', 'packages'], ['10', 'Which package to recommend', 'recommend'], ['11', 'The 30-day free trial', 'trial'], ['12', 'Closing, payment and handover', 'closing'],
  ['13', 'Your commission', 'commission'], ['14', 'Using the agent portal', 'portal'], ['15', 'Code of conduct', 'conduct'], ['16', 'FAQ', 'faq'], ['17', 'One-page cheat sheet', 'cheat'],
];
P('Contents', `
${sec('', 'Start here', 'Contents', 'Read this guide once from start to finish. After that, carry the cheat sheet on the last page and use the portal on your phone.')}
<div class="toc">${toc.map(([n, t, p]) => `<a><span class="tn">${n}</span><span>${t}</span><span class="tp">{{pp:${p}}}</span></a>`).join('')}</div>
<h2 style="margin-top:3mm">Your job in three parts</h2>
<div class="grid g3">
  ${card(feat('search', 'coral', 'Find', 'Visit shops that sell many items every day. Listen for losses they cannot explain.'))}
  ${card(feat('eye', 'navy', 'Show', 'Run the live demo on your phone in five to ten minutes. Let the owner tap it.'))}
  ${card(feat('handshake', 'teal', 'Start the trial', 'Open a 30-day free trial from the agent portal, follow up, and help the owner pay.'))}
</div>
<div class="grid g4">
  <div class="card tint"><div class="xs mute">Live demo, by business type</div><div class="mono" style="color:var(--text);font-size:7.8pt">…/pos/?demo=1<br>&amp;type=hardware</div></div>
  <div class="card tint"><div class="xs mute">Free trial (add your code)</div><div class="mono" style="color:var(--text);font-size:7.8pt">…/pos/?trial=1<br>&amp;ref=AG-XXXX</div></div>
  <div class="card tint"><div class="xs mute">Agent portal</div><div class="mono" style="color:var(--text);font-size:7.8pt">…/pos/agents/</div></div>
  <div class="card tint"><div class="xs mute">Support, phone &amp; WhatsApp</div><div class="mono" style="color:var(--text);font-size:7.8pt">${CONTACT.phone}<br>Mon–Sat 8am–6pm</div></div>
</div>
<p class="xs mute" style="margin-top:-1.6mm">… = pentarchcommunications.com. Business types for <span class="code">type=</span> are listed on page {{p:demo2}}.</p>
${callout('dark', 'The one rule above all others', 'Tell the truth. Only promise what you have seen working in the live demo. If you are not sure, say “Let me confirm with Pentarch” and call support. One honest agent sells more over a year than ten who over-promise.')}
`, 'contents');


/* 3 — First day quick start */
P('Quick start', `
${sec('★', 'Quick start · Anza hapa', 'Your first day', 'Eight things to know in the agent portal. Learn them before your first visit. <span style="color:var(--teal-d);font-style:italic">Mambo manane ya kujua kwenye portal kabla ya ziara yako ya kwanza.</span>')}
<div class="grid g3" style="gap:8mm;padding:0 3mm">
  ${phoneA('ag-home', [[42, 22, 1], [64, 66, 2], [64, 90, 3]], 'Home', '100%')}
  ${phoneA('ag-lead-detail', [[53, 19, 4, 'n'], [86, 56, 5], [5, 81, 6, 't']], 'Lead', '100%')}
  ${phoneA('ag-trial-done', [[88, 55, 7, 'n'], [88, 80, 8, 't']], 'Trial started', '100%')}
</div>
<div class="grid g2" style="gap:8mm">
  <div>
    ${qs(1, 'Your agent code. It is on every link you share.', 'Namba yako ya wakala. Iko kwenye kila link unayotuma.')}
    ${qs(2, 'Follow-ups due today. Call or WhatsApp them first.', 'Wateja wa kufuatilia leo. Wapigie au watumie WhatsApp kwanza.')}
    ${qs(3, 'New lead. Log every shop you visit, before you leave.', 'Mteja mpya. Andika kila duka unalotembelea kabla hujaondoka.')}
    ${qs(4, 'Call or WhatsApp the owner in one tap.', 'Mpigie au mtumie mwenye duka WhatsApp kwa kubonyeza mara moja.')}
  </div>
  <div>
    ${qs(5, 'Start 30-day trial after the demo.', 'Anzisha majaribio ya siku 30 baada ya demo.')}
    ${qs(6, 'Log visit and set the next follow-up date.', 'Andika ziara na weka tarehe ya kufuatilia.')}
    ${qs(7, 'Business code: the owner pays with this as the account number.', 'Namba ya biashara: mwenye duka analipa kwa namba hii kama akaunti.')}
    ${qs(8, 'Send on WhatsApp: the owner gets the login.', 'Tuma kwa WhatsApp: mwenye duka anapata maelezo ya kuingia.')}
  </div>
</div>
${callout('tip', 'Day one target · Lengo la siku ya kwanza', 'Practise the demo three times at home. Visit 10 shops. Log all 10. Start 1 trial. <span style="font-style:italic">Jizoeze demo mara tatu. Tembelea maduka 10, yaandike yote, anzisha majaribio 1.</span>')}
`, 'quick');

/* 3 — Product */
P('01 · The product', `
${sec('01', 'The product', 'Pentarch POS in one line', '<b>A till system that runs on the shop’s own computer, works without internet, and shows the owner what was sold, the profit, what is in stock and who owes money.</b>')}
<div class="grid g-7-5" style="align-items:center">
  ${monitor('duka-home', 'The owner’s Home screen: today’s sales, profit, payment methods, low stock and debtors.')}
  <div class="stack">
    ${callout('tip', 'Try before you pay', '30 days free on the owner’s own computer. No card, no deposit. Pentarch, Nairobi, supports it by WhatsApp and phone, Mon–Sat 8am–6pm.')}
    ${callout('warn', 'What to say about KRA eTIMS', 'Receipts show the KRA PIN and each item’s tax code (A–E). Full eTIMS through Pentarch is planned, not yet certified by KRA, no date yet. <b>Never say “eTIMS certified” or “KRA approved”.</b>')}
  </div>
</div>
<div class="grid g3">
  ${card(feat('cart', 'coral', 'Sells fast', 'Scan, search or tap. Cash, M-Pesa, card, credit or split. English or Kiswahili.'))}
  ${card(feat('wifioff', 'navy', 'Works offline', 'Sales never stop when the internet goes. Backs up when it returns.'))}
  ${card(feat('box', 'teal', 'Stock &amp; purchases', 'Receive deliveries, count stock, transfers, expiry, serials. Supplier balances.'))}
  ${card(feat('users', 'sun', 'Stops leakage', 'Staff PINs and roles. Theft report: discounts, voids, returns by staff.'))}
  ${card(feat('book', 'coral', 'Credit book (deni)', 'Sell on account, set limits, send statements by WhatsApp.'))}
  ${card(feat('bars', 'navy', '24 reports', 'Profit &amp; loss, VAT by tax code, best sellers, expenses, shifts.'))}
  ${card(feat('utensils', 'teal', 'Restaurants &amp; bars', 'Tables, kitchen tickets and kitchen screen, split bills, takeaway, delivery.'))}
  ${card(feat('scissors', 'sun', 'Salons &amp; services', 'Staff on each service, commission report, appointments.'))}
  ${card(feat('file', 'coral', 'Quotes &amp; invoices', 'A4 quotes by WhatsApp. Convert to an invoice or a sale.'))}
</div>
<div class="card tint"><h3>${icon('layers', { size: 15 })} One system, 18 business types</h3><p class="small" style="margin-bottom:1.6mm">The type switches on the right tools: variants, expiry, weights, serials, tables and kitchen, services, quotes.</p><div style="display:flex;flex-wrap:wrap;gap:1.4mm">${chip('General shop / duka', 'line')}${chip('Minimart &amp; supermarket', 'line')}${chip('Hardware', 'line')}${chip('Agrovet', 'line')}${chip('Pharmacy / chemist', 'line')}${chip('Boutique &amp; shoes', 'line')}${chip('Electronics &amp; phones', 'line')}${chip('Cosmetics', 'line')}${chip('Butchery', 'line')}${chip('Bakery', 'line')}${chip('Restaurant &amp; café', 'line')}${chip('Bar &amp; liquor', 'line')}${chip('Salon &amp; barber', 'line')}${chip('Stationery &amp; cyber', 'line')}${chip('Wholesale', 'line')}${chip('Auto spares', 'line')}${chip('LPG gas &amp; water', 'line')}${chip('Other / services', 'line')}</div></div>
`, 'product');

/* 4 — Who to target */
const fit = (n) => `<span style="white-space:nowrap">${[1, 2, 3].map((i) => `<span style="display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:2px;background:${i <= n ? 'var(--coral)' : 'var(--line)'}"></span>`).join('')}</span>`;
const T = (ic, name) => `<span style="display:flex;gap:6px;align-items:center;font-weight:700;color:var(--text)">${icon(ic, { size: 14 })}${name}</span>`;
P('02 · Who to target', `
${sec('02', 'Who to target', 'Business types ranked by fit', 'Go first where the pain is daily: many items, many sales, staff handling money, customers on credit.')}
${table(['#', 'Business type', 'Fit', 'The pain they feel', 'What solves it'], [
  ['1', T('store', 'Duka, minimart, supermarket'), fit(3), 'Cannot see daily profit. Cash goes missing. Stock runs out without warning.', 'Fast scan till, shift close with counted cash, low stock, receive and count stock'],
  ['2', T('wrench', 'Hardware &amp; building materials'), fit(3), 'Hundreds of items, sold by piece, bag or metre. Contractors buy on credit.', 'Units of measure, quotes → invoices, credit accounts and statements'],
  ['3', T('leaf', 'Agrovet'), fit(3), 'Farmers buy on credit. Seasonal stock. Chemicals and vaccines expire.', 'Credit book, batch and expiry fields, sell by kg or packet'],
  ['4', T('pill', 'Pharmacy / chemist'), fit(3), 'Expired stock losses. Strips vs boxes. Fast movers walk out.', 'Batch and expiry (earliest expiry sold first), strip/box units, staff PINs'],
  ['5', T('truck', 'Wholesale &amp; distribution'), fit(3), 'Two price lists. Cartons and pieces. Big debtor balances.', 'Wholesale prices, carton/piece barcodes, quotes → invoices, debtor balances'],
  ['6', T('shirt', 'Boutique, fashion &amp; shoes'), fit(3), 'Sizes and colours get mixed up. No idea what really sells.', 'Variants with their own barcodes, label printing, top sellers'],
  ['7', T('scale', 'Butchery'), fit(2), 'Weighed sales and cash leakage at the counter.', 'Decimal kg quantities, scale barcodes, cash count per shift'],
  ['8', T('sparkle', 'Cosmetics &amp; beauty shop'), fit(2), 'Many small items without barcodes. Shrinkage.', 'Generate barcodes and print labels in the app'],
  ['9', T('phone', 'Electronics &amp; phone shop'), fit(2), 'Must know which IMEI was sold to whom.', 'Serial / IMEI numbers on sale and on the receipt'],
  ['10', T('book', 'Stationery, bookshop, cyber'), fit(2), 'Mix of services (printing) and products.', 'Service items and products on one bill'],
  ['11', T('car', 'Auto spares'), fit(2), 'Part numbers, mechanics on credit.', 'Search by SKU or part number, credit accounts'],
  ['12', T('scissors', 'Salon, barber &amp; spa'), fit(2), 'Arguments about staff commission. Missed bookings.', 'Staff on each service, commission report, appointments'],
  ['13', T('utensils', 'Restaurant, café, bar'), fit(2), 'Lost orders, kitchen mix-ups, split bills.', 'Tables, kitchen tickets and kitchen screen, split bills, takeaway'],
  ['14', T('flame', 'Bakery, LPG, water refill'), fit(1), 'Simple menus, cylinder deposits.', 'Quick-key grid, deposits as products'],
], { cls: 'tight fit', widths: ['4%', '28%', '7%', '30%', '31%'] })}
<div class="grid g2">
  ${card(`<h3>${icon('check', { size: 15, color: 'var(--teal-d)' })} Good signs</h3><p class="small">Busy counter · owner not always in the shop · two or more staff handle money · stock or deni kept in a book or Excel · a computer already in the shop</p>`)}
  ${card(`<h3>${icon('x', { size: 15, color: 'var(--coral-d)' })} Not now — log and move on</h3><p class="small">Very few items and low sales · closing or moving soon · locked into another POS contract · refuses any demo (return in a month)</p>`)}
</div>
`, 'target');

/* 5 — Where to find them */
const route = (ic, c, t, where, how) => card(`<div class="feat"><span class="ibox ${c}">${icon(ic, { size: 16 })}</span><div><h3>${t}</h3><p class="small"><b>Where:</b> ${where}</p><p class="small"><b>How:</b> ${how}</p></div></div>`);
P('03 · Where to find them', `
${sec('03', 'Prospecting', 'Where to find them', 'Work one area per day. Walk the whole street, log every shop in the portal (GPS on), and come back to the warm ones.')}
<div class="grid g2">
  ${route('building', 'coral', 'Markets and shopping centres', 'Town markets, malls, shopping arcades, bus-stage shopping strips.', 'Start at the busiest end. Visit in the mid-morning lull (10–12). Avoid peak hours.')}
  ${route('pin', 'navy', 'Estates and residential stages', 'Dukas, minimarts, butcheries and chemists at estate gates and matatu stages.', 'These owners often run two shops. Ask about the second branch.')}
  ${route('route', 'teal', 'Town centres and main roads', 'Hardware, agrovets, auto spares, boutiques along main roads in Kiambu, Thika, Kitengela, Ruiru, Rongai.', 'Bring a printed price list. Hardware owners like to see the Complete Till items.')}
  ${route('truck', 'sun', 'Wholesalers’ customers', 'Dukas supplied by a local wholesaler or distributor.', 'Ask a friendly wholesaler for an introduction, or stand where retailers collect stock.')}
  ${route('chat', 'coral', 'WhatsApp business groups', 'Estate business groups, traders’ groups, church and alumni groups you belong to.', 'Share a short demo video and your demo link. Never spam groups you are not in.')}
  ${route('coins', 'navy', 'Chamas and SACCOs', 'Women and youth chamas, SACCO business members, market associations.', 'Ask for 10 minutes at a meeting. Show one sale and the deni book. Book follow-up demos.')}
</div>
${callout('dark', 'Referrals — your best source. And log everything the same day.', 'Every happy client knows five other owners: at handover and again at day 30, ask “Who else should see this?” A lead that is not in the portal does not exist — the portal records who brought each business, and that is how your commission is tracked.', 'handshake')}
<h2>Example week: one area per day</h2>
${table(['Day', 'Area (example)', 'Focus', 'Afternoon'], [
  ['Mon', 'Thika town centre', 'Hardware, agrovets, chemists', 'Booked demos'],
  ['Tue', 'Ruiru and Kimbo estates', 'Dukas and minimarts at estate gates', 'Trial visits (day 3 and 7)'],
  ['Wed', 'Juja and Gachororo', 'Butcheries, cosmetics, chemists', 'Booked demos'],
  ['Thu', 'At a wholesaler’s', 'Retailers collecting stock', 'Day 21 and 28 closes'],
  ['Fri', 'Market day', 'Boutiques, shoe shops, stalls with many items', 'Installations and handovers'],
], { cls: 'tight', widths: ['8%', '28%', '40%', '24%'] })}
`, 'where');

/* 6 — Day & targets */
const fb = (w, bg, v, l) => `<div class="fbar" style="width:${w}%;background:${bg}"><span>${l}</span><span class="fv">${v}</span></div>`;
P('04 · Your day', `
${sec('04', 'Routine and targets', 'Your day and your targets', 'Selling is a numbers game you can control. Do the visits and the sales follow.')}
<div class="grid g-5-7">
  <div class="card">
    <h2>A good field day</h2>
    <div class="funnel" style="margin-top:2mm">
      ${fb(100, 'var(--ink)', '20', 'Visits')}
      ${fb(78, 'var(--navy)', '6', 'Demos')}
      ${fb(56, 'var(--coral-d)', '2', 'Trials started')}
      ${fb(40, 'var(--teal-d)', '1', 'Sale')}
    </div>
    <p class="small mute" style="margin-top:3mm">Trials last 30 days, so sales start in week 5. From then on, a steady pipeline gives about one paying client per field day.</p>
  </div>
  <div class="card">
    <h2>Daily routine</h2>
    ${table(['Time', 'What to do'], [
      ['<span class="mono">07:30</span>', 'Check the portal: follow-ups due today, trials ending. Plan your area.'],
      ['<span class="mono">08:30</span>', 'Visits. Short intro, two or three questions, demo if they have time.'],
      ['<span class="mono">12:30</span>', 'Lunch. Send day 1, 3 and 7 trial messages by WhatsApp.'],
      ['<span class="mono">14:00</span>', 'Booked demos and return visits. Start trials on the spot.'],
      ['<span class="mono">17:00</span>', 'Log every visit, set next follow-up dates, sync.'],
    ], { cls: 'tight', widths: ['18%', '82%'] })}
  </div>
</div>
<h2>Weekly targets</h2>
<div class="grid g4">
  ${card(stat('100', 'visits per week (5 field days)'))}
  ${card(stat('30', 'demos per week'))}
  ${card(stat('10', 'trials started per week'))}
  ${card(stat('5', 'paying clients per week from week 5'))}
</div>
${callout('dark', 'What the targets are worth', 'Five paying clients a week — say one Complete Till, one Software + Setup and three yearly subscriptions — earns about <b>KES 11,700 a week</b> in commission (3,000 + 1,500 + 3 × 2,400). See page {{p:commission}} for the rules.', 'coins')}
<div class="grid g2">
  ${card(`<h3>${icon('checklist', { size: 15 })} What to carry</h3>${checklist(['Phone, charged, portal installed, demo open', 'Power bank and data bundles', '10 printed price lists', 'Notebook and pen', 'Pentarch agent ID or letter', 'Your agent code written on your price lists'])}`)}
  ${card(`<h3>${icon('user', { size: 15 })} How to look and behave</h3>${dots(['Clean, smart-casual; Pentarch T-shirt if issued', 'Arrive on time for every booked demo', 'Wait if there are customers — never interrupt a sale', 'Ask before you take photos', 'Leave the shop as you found it'])}`)}
</div>
`, 'day');

/* 7 — Pitch */
P('05 · The pitch', `
${sec('05', 'The 60-second pitch', 'Say it in one minute', 'Learn it until it sounds like you. Use the language the owner speaks. Then stop talking and show the demo.')}
<div class="grid g2">
  <div class="pitch card" style="border-top:4px solid var(--coral)">
    <div class="lang" style="color:var(--coral-d)">${icon('chat', { size: 14 })} English</div>
    <p>“Hello, I’m [name] from Pentarch Communications in Nairobi. I help shops like yours stop losing money they cannot see.</p>
    <p>Pentarch POS is a till system that runs on your own computer. Your cashier scans or taps an item, takes cash, M-Pesa or credit, and prints a receipt. In the evening you see what was sold, your profit, what is running low and who owes you — even on your phone.</p>
    <p>It works without internet. Every staff member has their own PIN, so every sale, discount and drawer opening is recorded.</p>
    <p>It costs KES 1,200 a month — about 40 shillings a day — and you can try it free for 30 days on your own computer. May I show you on my phone? It takes five minutes.”</p>
  </div>
  <div class="pitch card" style="border-top:4px solid var(--teal)">
    <div class="lang" style="color:var(--teal-d)">${icon('chat', { size: 14 })} Kiswahili</div>
    <p>“Habari yako, naitwa [jina] kutoka Pentarch Communications, hapa Nairobi. Nasaidia maduka kama lako kuzuia hasara ambayo huioni.</p>
    <p>Pentarch POS ni mfumo wa kuuza unaotumia kompyuta yako mwenyewe. Mhudumu anascan au anagusa bidhaa, anapokea cash, M-Pesa au deni, na anaprint risiti. Jioni unaona kila kitu kilichouzwa, faida yako, bidhaa zinazoisha na madeni ya wateja — hata kwa simu yako.</p>
    <p>Inafanya kazi bila internet. Kila mfanyakazi ana PIN yake, kwa hivyo kila mauzo, kila punguzo na kila mara droo inafunguliwa, vyote vinarekodiwa.</p>
    <p>Ni shilingi 1,200 kwa mwezi — kama shilingi 40 kwa siku — na unaweza kujaribu bure kwa siku 30 kwa kompyuta yako. Nikuonyeshe kwa simu yangu? Ni dakika tano tu.”</p>
  </div>
</div>
<h2>Openers for common situations</h2>
${table(['Situation', 'Say'], [
  ['Owner is busy with customers', '“I can see you are busy. I will wait — I only need five minutes when the queue clears.”'],
  ['Only the cashier is there', '“When is the owner around? Please give them this price list — my number is on it.” Log a follow-up.'],
  ['Owner already has a POS', '“How is it working for you? What would you change?” Listen. Leave the demo link.'],
  ['Owner says “I have no time”', '“Can I send you a two-minute demo link on WhatsApp? Try it tonight and I will call tomorrow.”'],
], { cls: 'tight', widths: ['30%', '70%'] })}
<div class="grid g3">
  ${card(`<h3>${icon('target', { size: 15, color: 'var(--coral-d)' })} Open with their pain</h3><p class="small">“Do you know exactly how much profit you made yesterday?” works better than any feature list.</p>`)}
  ${card(`<h3>${icon('eye', { size: 15, color: 'var(--navy)' })} Show, don’t tell</h3><p class="small">Put the phone in the owner’s hand by minute two. People buy what they have touched.</p>`)}
  ${card(`<h3>${icon('ban', { size: 15, color: 'var(--coral-d)' })} Never say</h3><p class="small">“eTIMS certified”, “KRA approved”, “never breaks”, “free forever”, or anything bad about a competitor.</p>`)}
</div>
`, 'pitch');

/* 8 — Discovery */
P('06 · Discovery', `
${sec('06', 'Discovery questions', 'Ask, then listen', 'Ask three or four of these before the demo. The answers tell you which screens to show and which package fits. Write them in the lead notes.')}
${table(['Question', 'Listen for', 'Then show'], [
  ['How do you record sales today?', 'Book, Excel, memory, another POS', 'Fast sale + Home dashboard'],
  ['How do you know your profit for the day?', '“I don’t”, “at month end”', 'Home, then Profit &amp; loss report'],
  ['Who handles the money when you are not here?', 'Staff, relatives, worries about trust', 'Staff PINs, shift close, theft report'],
  ['How often do items run out before you notice?', 'Lost sales, emergency restocking', 'Low stock, receive stock, count stock'],
  ['Do customers buy on credit? How do you track it?', 'A deni book, forgotten debts', 'Customers → credit balance, WhatsApp statement'],
  ['How many items do you stock? Do they have barcodes?', 'Hundreds; many without barcodes', 'Scan to sell, generate and print labels'],
  ['How do customers pay — cash, M-Pesa, card?', 'Mostly M-Pesa', 'M-Pesa payment with code check, split payments'],
  ['Is there a computer in the shop? Windows? Internet?', 'Yes / no / unreliable', 'Choose the package (page {{p:recommend}}). Offline works.'],
  ['Do you send quotations or invoices to customers?', 'Contractors, schools, LPOs', 'Quote → invoice, on A4 or WhatsApp'],
  ['Do you have, or plan, another branch?', 'Second shop, family branch', 'Multi-branch, extra branch price'],
  ['What would make this worth KES 1,200 a month to you?', 'Their own words — your closing line', 'Repeat it back at the close'],
], { widths: ['38%', '32%', '30%'] })}
<div class="grid g-7-5">
<div class="card tint"><h3>${icon('file', { size: 15 })} Good lead notes look like this</h3><p class="small mono" style="font-size:8.2pt;color:var(--text);line-height:1.55">Kamau Hardware, Juja. Owner Peter, 2 staff. Stock in exercise book, ~600 items, most without barcodes. Contractors on credit, ~KES 80k owed. Has an old Dell desktop, no printer. Power cuts weekly. Interested in Counter Kit + labels. Demo Thu 10am.</p></div>
${callout('tip', 'The best question of all', 'If the owner tells you about a loss — missing cash, expired stock, an unpaid debt — ask: <b>“How much do you think that cost you last month?”</b> Let them say the number. Then compare it with KES 1,200.')}
</div>
`, 'discovery');

/* 9 — Demo script */
const dstep = (min, title, text, img) => `<div class="card" style="padding:2.6mm;display:flex;flex-direction:column;gap:1.6mm"><div class="row" style="gap:6px"><span class="chip ink">${min}</span><h3 style="margin:0;font-size:9.2pt">${title}</h3></div>${img ? `<img class="shot" src="${img}">` : ''}<p class="small">${text}</p></div>`;
import { IMG } from '../lib.mjs';
P('07 · The demo', `
${sec('07', 'The 10-minute demo', 'Step by step', `Open <span class="code">${CONTACT.demoType}duka</span> before you walk in, with the owner’s type at the end (page {{p:demo2}}), or use <b>Share demo link</b> in the portal, which adds your code. Demo data stays on your phone only.`)}
<div class="grid g3">
  ${dstep('0:00', 'Pick their business type', 'Use the link with <span class="code">type=</span>, or tap <b>Try the demo</b> and choose the type. The demo fills with Kenyan products and 30 days of sales.', IMG('welcome'))}
  ${dstep('1:00', 'Home: the owner’s view', 'One sentence says today’s sales against last week. Then profit, payment split, low stock, debtors. Ask: “Do you know these numbers today?”', IMG('o-home'))}
  ${dstep('2:30', 'Make a sale', 'Open <b>Sell</b>. Tap three items or search by name. Show quantity, the total and how quickly it adds up.', IMG('duka-sell'))}
  ${dstep('4:00', 'Take payment', 'Tap <b>Pay</b>. Show cash with change, then M-Pesa with the code check. Show the receipt and the WhatsApp receipt button.', IMG('duka-tender-mpesa'))}
  ${dstep('5:30', 'Products, barcodes, labels', 'Open a product. Show <b>Generate EAN-13</b> and <b>Print labels</b>. For shops with unlabelled stock this sells itself.', IMG('duka-labels'))}
  ${dstep('7:00', 'Credit and cash control', 'Open <b>Customers</b>: who owes what. Then <b>Cash &amp; shifts</b>: expected vs counted cash for each shift.', IMG('duka-shifts'))}
</div>
<div class="grid g-7-5">
  ${card(`<div class="row" style="gap:6px;margin-bottom:1.4mm"><span class="chip coral">8:30</span><h3 style="margin:0">Close: start the trial</h3></div><p class="small">“Everything you saw works on your own computer, free for 30 days. Shall I set it up for you now? I only need your name, phone and email.” Open the lead in the portal and tap <b>Start 30-day trial</b>. Owner prefers to do it alone? Send <span class="code nowrap">…/pos/?trial=1&amp;ref=</span> + your code.</p>`)}
  ${callout('warn', 'Demo do’s and don’ts', 'Use <b>Reset demo</b> between shops. Turn your data off once and show that selling still works. Never type the owner’s real stock or customers into the demo — that goes into their trial.')}
</div>
<div class="grid g2">
  ${card(`<h3>${icon('bolt', { size: 15, color: 'var(--sun-d)' })} Look fluent on a computer: shortcuts</h3><p class="small"><span class="kbd">F2</span> Sell / search &nbsp; <span class="kbd">F4</span> Pay &nbsp; <span class="kbd">F9</span> Add customer &nbsp; <span class="kbd">F8</span> Hold &nbsp; <span class="kbd">F7</span> Recall &nbsp; <span class="kbd">Enter</span> Complete sale. Type <span class="code">3*jogoo</span> to add three of an item.</p>`)}
  ${card(`<h3>${icon('lock', { size: 15, color: 'var(--navy)' })} If the lock screen appears</h3><p class="small">The demo locks like a real till. Tap a staff tile and enter the PIN shown on the demo lock screen. Explain: “Each of your staff will have their own PIN like this.”</p>`)}
</div>
`, 'demo');

/* 10 — Demo by type */
const tk = (...k) => k.map((x) => `<span class="mono" style="font-size:8pt;color:var(--text)">${x}</span>`).join(' · ');
P('07 · The demo', `
${sec('07', 'The 10-minute demo', 'What to show each business type', `Same script, different emphasis. Open the demo with the owner’s type: <span class="code">${CONTACT.demoType}<b>hardware</b></span>`)}
${table(['Business type', 'type=', 'Show first', 'Then'], [
  ['Duka, minimart', tk('duka', 'minimart'), 'Scan or tap sale, cash + M-Pesa split', 'Receive stock, count stock (page {{p:demo4}})'],
  ['Hardware', tk('hardware'), 'Cement by bag, nails by kg, VAT on receipt', 'Quote → invoice (page {{p:demo4}})'],
  ['Agrovet', tk('agrovet'), 'Credit sale to a farmer, payment later', 'Batch and expiry; expiry list'],
  ['Pharmacy / chemist', tk('pharmacy'), 'Sell by strip; earliest expiry sold first', 'Expiry list, staff PINs, theft report'],
  ['Wholesale', tk('wholesale'), 'Carton vs piece, wholesale price', 'Quote → invoice, debtor balances'],
  ['Boutique, cosmetics', tk('boutique', 'cosmetics'), 'Sizes and colours (variants)', 'Generate barcodes, print labels'],
  ['Electronics, phones', tk('electronics'), 'IMEI captured on the sale', 'Receive stock with serial numbers'],
  ['Butchery', tk('butchery'), 'Sell 1.25 kg of beef', 'Cash count at shift close'],
  ['Salon, barber, spa', tk('salon'), 'Pick the stylist on each service', 'Commission report, appointments (page {{p:demo3}})'],
  ['Restaurant, café, bar', tk('restaurant', 'bar'), 'Tables → send to kitchen', 'Split bill, kitchen display (page {{p:demo3}})'],
  ['Every owner', 'their type', 'Home: today in one sentence', 'Profit &amp; loss, theft report (page {{p:demo5}})'],
], { cls: 'tight', widths: ['21%', '20%', '31%', '28%'] })}
<p class="xs mute" style="margin-top:-1.4mm">Other types: <span class="mono">bakery · stationery · autospares · gas_water · other</span>. If the shop has a computer, open the demo on it: it answers “will it work on my computer?”</p>
<div class="grid g3">
  ${shotC('hardware-cart', [69, 18, 100, 52], [], 'Hardware: cement by the bag, ballast by the tonne')}
  ${shotC('salon-cart', [69, 18, 100, 52], [], 'Salon: the stylist on each service')}
  ${shotC('pharmacy-cart', [69, 18, 100, 52], [], 'Chemist: medicines sold by the strip')}
</div>
`, 'demo2');

/* 10b — Demo scripts per type (new modules) */
const dscript = (ic, c, title, key, time, shots, lines, cols) => `<div class="card" style="padding:2.8mm 3.4mm;display:flex;flex-direction:column;gap:2mm">
  <div class="row" style="gap:2.4mm"><span class="ibox ${c}">${icon(ic, { size: 15 })}</span><h2 style="margin:0;font-size:12pt">${title}</h2><span class="chip line" style="margin-left:auto"><span class="mono">type=${key}</span></span><span class="chip ink">${time}</span></div>
  <div class="grid" style="grid-template-columns:${cols || `repeat(${shots.length},1fr)`};gap:2.6mm;align-items:start">${shots.join('')}</div>
  <div class="grid g2" style="column-gap:6mm">${lines.map((l, i) => qs(i + 1, l[0], l[1], 'c')).join('')}</div></div>`;
P('07 · Demo scripts', `
${sec('07', 'Demo scripts · 1 of 3', 'Restaurants and salons', 'Run these after the basic sale. Each marker on a screen matches a numbered line. Say the English or the Kiswahili line as you tap.')}
${dscript('utensils', 'coral', 'Restaurant, café, bar: tables → kitchen → split bill', 'restaurant', '3 min', [
  shotC('r-floor', [17.5, 9, 70, 67], mk('r-floor', [1])),
  shotC('r-table-order', [55, 9, 100, 58.5], mk('r-table-order', [null, 2])),
  shotC('r-split', [23, 14, 77, 74], mk('r-split', [3])),
], [
  ['Tables: tap a free table, enter the guests.', 'Gusa meza iliyo wazi, weka idadi ya wageni.'],
  ['Add food and drinks, then Send to kitchen: one ticket for the kitchen, one for the bar.', 'Ongeza chakula na vinywaji, kisha Send to kitchen: tiketi ya jikoni na ya bar.'],
  ['Split bill: tap + on what each person pays for, or split equally.', 'Gusa + kwa anacholipia kila mtu, au gawa sawa kwa sawa.'],
  ['Open Kitchen display: the cook taps Done and the table shows Ready.', 'Fungua Kitchen display: mpishi anabonyeza Done, meza inaonyesha Ready.'],
])}
${dscript('scissors', 'sun', 'Salon, barber, spa: staff and commission', 'salon', '2 min', [
  shotC('s-staff-picker', [22, 19, 78, 81], mk('s-staff-picker', [1])),
  shotC('s-commission', [17.5, 9, 72, 69], mk('s-commission', [2])),
  shotC('s-appointments', [17.5, 9, 100, 100], mk('s-appointments', [null, 3])),
], [
  ['Add a service: pick who is doing it.', 'Ongeza huduma: chagua anayeifanya.'],
  ['Staff commission: what each person earned, ready to pay.', 'Kamisheni: kila mfanyakazi amepata kiasi gani, tayari kulipwa.'],
  ['Appointments: when the client arrives, tap Arrived to start the sale.', 'Mteja akifika, bonyeza Arrived kuanza mauzo.'],
  ['Ask: “How do you work out commission today?”', 'Uliza: “Unahesabu kamisheni namna gani sasa?”'],
])}
${callout('info', 'What to say about the kitchen', 'Kitchen tickets print on the till’s receipt printer. A kitchen screen is optional: any tablet or computer with Chrome, signed in to the business, with internet at both ends. Pentarch advises on the devices.')}
`, 'demo3');
P('07 · Demo scripts', `
${sec('07', 'Demo scripts · 2 of 3', 'Hardware, wholesale and shops')}
${dscript('wrench', 'navy', 'Hardware, wholesale: quote → invoice', 'hardware', '2 min', [
  shotC('q-editor', [17.5, 9, 100, 100], mk('q-editor', [1, 2, 3])),
  shotC('q-invoices', [17.5, 9, 100, 100], mk('q-invoices', [4])),
], [
  ['New quote: customer, items, prices, valid for 14 days.', 'Nukuu mpya: mteja, bidhaa, bei, halali siku 14.'],
  ['Print on A4 or send by WhatsApp.', 'Chapisha A4 au tuma kwa WhatsApp.'],
  ['Convert to invoice: stock goes out, the balance is tracked.', 'Badilisha kuwa ankara: stoki inatoka, deni linafuatiliwa.'],
  ['Invoices: paid, part paid or overdue at a glance.', 'Ankara: zilizolipwa, nusu au zilizochelewa.'],
])}
${dscript('store', 'teal', 'Duka, minimart: receive stock, count stock', 'minimart', '2 min', [
  shotC('p-receive', [17.5, 9, 100, 100], mk('p-receive', [1, 2, 3])),
  shotC('i-count', [17.5, 9, 100, 100], mk('i-count', [4, 5])),
], [
  ['Receive stock: choose the supplier.', 'Pokea stoki: chagua msambazaji.'],
  ['Scan each item that arrived. Cost prices update.', 'Scan kila bidhaa iliyofika. Bei za kununua zinasasishwa.'],
  ['Receive stock: stock goes up, the supplier balance is kept.', 'Stoki inaongezeka, deni la msambazaji linawekwa.'],
  ['Count stock: scan the shelf, each scan adds one.', 'Hesabu stoki: scan rafu, kila scan inaongeza moja.'],
  ['Check differences: shortages in shillings.', 'Angalia tofauti: upungufu kwa shilingi.'],
])}
`, 'demo4');
P('07 · Demo scripts', `
${sec('07', 'Demo scripts · 3 of 3', 'For every owner: the numbers', 'Finish every demo here. Owners buy when they see their own questions answered.')}
${dscript('chart', 'coral', 'Every owner: dashboard, profit and loss, theft report', 'duka', '2 min', [
  shotC('o-home', [17.5, 9, 52, 56], [...mk('o-home', [1]), [19.6, 40.5, 2]]),
  shotC('o-pnl', [56, 12, 100, 72], mk('o-pnl', [3])),
  shotC('o-exceptions', [17.5, 12, 62, 72], mk('o-exceptions', [4, 5])),
], [
  ['Home: today’s sales in one sentence.', 'Home: mauzo ya leo kwa sentensi moja.'],
  ['Sales, receipts and profit, compared with yesterday.', 'Mauzo, risiti na faida, ikilinganishwa na jana.'],
  ['Profit &amp; loss: what the business made after expenses.', 'Faida na hasara: biashara ilipata nini baada ya matumizi.'],
  ['Theft report: discounts, voids, returns by staff.', 'Ripoti ya wizi: punguzo, kufuta na kurudisha kwa kila mfanyakazi.'],
  ['Each one has the time, staff, receipt and reason.', 'Kila moja lina saa, mfanyakazi, risiti na sababu.'],
])}
<h2>Owner questions the reports answer</h2>
${table(['The owner asks', 'Open', 'Kiswahili'], [
  ['“Am I making money?”', 'Reports → <b>Profit &amp; loss</b>', '“Napata faida?”'],
  ['“Is someone stealing from me?”', 'Reports → <b>Discounts, voids, returns &amp; price changes</b>', '“Kuna mtu ananiibia?”'],
  ['“What should I order?”', 'Reports → <b>Low stock &amp; reorder</b>', '“Niagize nini?”'],
  ['“Who owes me, and for how long?”', 'Reports → <b>Debtors aging</b>', '“Nani ananidai, tangu lini?”'],
  ['“What do I owe my suppliers?”', 'Reports → <b>Supplier balances</b>', '“Nadaiwa na wasambazaji kiasi gani?”'],
  ['“Where does my money go?”', '<b>Expenses</b> (rent, salaries, transport)', '“Pesa zangu zinaenda wapi?”'],
  ['“How much VAT for my return?”', 'Reports → <b>VAT &amp; tax (eTIMS codes)</b>', '“VAT yangu ni kiasi gani?”'],
], { cls: 'tight', widths: ['32%', '44%', '24%'] })}
${callout('warn', 'VAT report is not eTIMS', 'The VAT report groups sales by KRA tax code A–E to help with the VAT return. It does not send anything to KRA. Full eTIMS is planned, not yet certified.')}
`, 'demo5');

/* 11–12 — Objections */
const obj = (n, q, a, d) => `<div class="obj"><div class="q"><span class="n">${String(n).padStart(2, '0')}</span>“${q}”</div><div class="a"><p>${a}</p></div><div class="do">${icon('arrow', { size: 13 })}<span><b>Do:</b> ${d}</span></div></div>`;
const OBJ = [
  ['I use a book.', 'A book only shows what someone wrote down. Pentarch POS records every sale by itself and adds up your profit, stock and debts every evening. Keep the book for a week next to it and compare.', 'show Home, then the expected vs counted cash at shift close.'],
  ['It’s too expensive.', 'KES 1,200 a month is about KES 40 a day — less than one missing packet of sugar. The first 30 days are free, so you only pay once you have seen the savings yourself.', 'ask what they lost last month, then start the free trial.'],
  ['There’s no internet here.', 'It works fully offline. Sales, receipts and stock are kept on the computer. When internet returns — even a phone hotspot for a few minutes — it backs up by itself.', 'turn off your phone data and make a sale in the demo.'],
  ['My staff can’t use computers.', 'If they can use M-Pesa, they can use this. Tap a picture or scan, choose cash or M-Pesa, done. The screens are also in Kiswahili. Setup packages include training for up to 3 staff.', 'hand the phone to the cashier and let them sell.'],
  ['What about KRA and eTIMS?', 'Receipts already show your KRA PIN and the tax code of each item. Full eTIMS through Pentarch is planned but not yet certified by KRA. Until Pentarch announces it, keep using your current eTIMS method.', 'say exactly this. Never say “eTIMS certified”.'],
  ['What if the computer breaks?', 'Your data backs up to the cloud whenever you are online. Sign in on another computer and it all comes back. Complete Till devices carry a 6 to 12-month supplier warranty and Pentarch handles the claims. The UPS keeps the till running through a power cut.', 'show the “Synced” status at the top of the screen.'],
  ['Does it work with M-Pesa?', 'Yes. The cashier picks M-Pesa and enters the code; the app checks it, and the Home screen and shift report split cash from M-Pesa. A payment prompt on the customer’s phone (STK push) can be added for your own till after Safaricom approves it.', 'show the M-Pesa payment screen with the till number.'],
  ['I tried a POS before and it failed.', 'What went wrong? Most fail because they are complicated, need internet or have no support. This one works offline, is simple, speaks Kiswahili and has local WhatsApp support. And you test it free for 30 days first.', 'write down what failed and demo that exact thing.'],
  ['Is my data safe?', 'Each business’s data is kept separate. Staff need a PIN and only see what their role allows. You can download a full backup at any time, and your data is never locked away from you — even if you stop paying, you can still view and export it.', 'show Settings → Backup &amp; export.'],
  ['I’ll think about it.', 'Of course. What would you like to be sure about? Meanwhile, start the free trial so you can think while using it. It costs nothing and there is nothing to cancel.', 'set a follow-up date in the portal before you leave.'],
  ['Techlion or Uzapoint is better known.', 'Our price matches Techlion: KES 1,200 a month or 12,000 a year. You also get a 30-day free trial on your own computer, a live demo right now, Kiswahili, offline selling, a credit book, labels and local support.', 'let the owner use the demo. Never run down a competitor.'],
  ['I don’t have a computer.', 'The Complete Till is everything for KES 69,900: desktop and 19-inch screen, backup power, scanner, printer, cash drawer, paper, installation, training and 12 months of software. Or use any Windows computer or laptop with Chrome.', 'show the price list and the package chooser on page {{p:recommend}}.'],
];
P('08 · Objections', `
${sec('08', 'Handling objections', 'The 12 you will hear most', 'Agree first, answer in two or three sentences, then show it. An objection is a request for proof.')}
<div class="grid g2">${OBJ.slice(0, 6).map((o, i) => obj(i + 1, ...o)).join('')}</div>
<h2>The four-step answer</h2>
${hsteps([{ t: 'Listen', d: 'Let the owner finish. Do not interrupt.' }, { t: 'Agree', d: '“That’s a fair question.”' }, { t: 'Answer', d: 'Two or three plain sentences.' }, { t: 'Show', d: 'Prove it in the demo, then ask: “Does that answer it?”' }], 4)}
`, 'objections');
P('08 · Objections', `
<div class="grid g2">${OBJ.slice(6).map((o, i) => obj(i + 7, ...o)).join('')}</div>
<h2>How we compare (published prices, checked 9 Nov 2026)</h2>
${table(['', 'Pentarch POS', 'Techlion POS', 'Uzapoint', 'Loyverse'], [
  ['Price', 'KES 1,200/month or 12,000/year', 'KES 1,200/month or 12,000/year', 'Quote only (no public prices)', 'Free core; paid add-ons in USD'],
  ['Free trial', '30 days on own computer', 'Yes, length not stated', 'Yes, length not stated', '14 days per add-on'],
  ['Works offline', 'Yes, fully', 'Yes, syncs later', 'Not stated', 'Yes'],
  ['Local M-Pesa', 'Code entry; STK on own till', 'STK push', 'Till/paybill reconciliation', 'No native M-Pesa'],
], { cls: 'tight', widths: ['16%', '22%', '22%', '20%', '20%'] })}
<p class="xs mute">Source: each vendor’s own website. Use it to answer honestly, never to run a competitor down.</p>
`, 'objections2');

/* 13 — Packages */
const pkg = (name, price, unit, forWho, items, flag = '', hero = false) => `<div class="pk ${hero ? 'hero' : ''}">${flag ? `<div class="flag">${flag}</div>` : ''}<div class="top"><div class="name">${name}</div><div class="for">${forWho}</div><div class="price" style="font-size:21pt;margin-top:2.4mm">${price}</div><div class="xs mute" style="margin-top:.8mm;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${unit}</div></div><div class="body">${ticks(items)}</div></div>`;
P('09 · Packages & prices', `
${sec('09', 'Packages and prices', 'What the client pays', 'Every client starts with the 30-day free trial on their own computer. Quote these prices exactly. Never give your own discount.')}
<div class="grid g3">
  ${pkg('Software only', 'KES 1,200', 'per month · or KES 12,000 per year', 'After the free trial, on the client’s own computer', ['Yearly plan = 2 months free', 'Unlimited products, users and devices in one branch', 'Cloud backup and sync', 'Updates included', 'WhatsApp support Mon–Sat, 8am–6pm', 'Extra branch: <b>+KES 1,000/month</b> (KES 10,000/year)'])}
  ${pkg('Software + Setup', 'KES 15,000', 'one-off · 12 months software included', 'Client has a Windows computer or laptop', ['Installation, remote or on site', 'Training for the staff', 'Up to 300 products loaded', 'Or pay monthly: <b>KES 3,500 setup + KES 1,200/month</b>', 'Needs Core i3, 4 GB RAM or better, and Chrome'])}
  ${pkg('Complete Till', 'KES 69,900', 'one price · 12 months software included', 'Everything to sell on day one', ['HP mini desktop + 19-inch screen, keyboard, mouse', 'UPS backup power for blackouts', '2D barcode scanner', '80 mm receipt printer', 'Cash drawer', '10 rolls of receipt paper', 'Delivery, setup, training for 3 staff, 300 products loaded'], 'Best value', true)}
</div>
<h2>Add-ons</h2>
${table(['Add-on', 'What it is', 'Price'], [
  ['<b>Counter Kit</b>', 'Scanner, receipt printer, cash drawer, 10 rolls, installed. For clients with their own computer.', '<b class="nowrap">KES 21,900</b>'],
  ['<b>Extra till</b>', 'Second mini desktop, 19-inch screen, keyboard and mouse, scanner and printer. Same branch, installed.', '<b class="nowrap">KES 44,900</b>'],
  ['<b>Label printer kit</b>', 'Xprinter XP-470B and 2 rolls of 40 × 30 mm labels, set up.', '<b class="nowrap">KES 16,500</b>'],
  ['<b>Extra UPS</b>', 'Mercury Elite 650 Pro, for an extra till or the client’s own desktop.', '<b class="nowrap">KES 8,500</b>'],
  ['<b>Receipt paper carton</b>', '50 rolls, 80 × 80 mm.', '<b class="nowrap">KES 7,000</b>'],
  ['<b>Extra product loading</b>', 'Beyond the 300 items included, per 500 items.', '<b class="nowrap">KES 2,000</b>'],
], { cls: 'tight', align: ['', '', 'r'], widths: ['22%', '60%', '18%'] })}
${callout('info', 'Fine print', 'Complete Till delivery and installation are free within Nairobi; outside Nairobi, transport is charged at cost. Devices carry a 6 to 12-month supplier warranty and Pentarch handles the claims. The client’s own laptop is fine for Software + Setup.')}
`, 'packages');

/* 14 — Which package */
const qn = (t) => `<div class="q-node">${t}</div>`;
const an = (name, txt, color) => `<div class="a-node" style="border-top:3px solid ${color}"><span class="pkname">${name}</span>${txt}</div>`;
const arrow = (lab, cls) => `<div style="display:flex;justify-content:center;align-items:center;gap:4px;height:7.5mm;font-size:7.6pt;font-weight:700;letter-spacing:.04em" class="${cls}">${icon('arrowdown', { size: 13 })}${lab}</div>`;
const need = (ic, c, t, d, price) => `<div class="card" style="display:flex;gap:3mm;align-items:center;padding:3mm 3.6mm"><span class="ibox ${c}">${icon(ic, { size: 16 })}</span><div class="grow"><h3 style="margin:0;font-size:10pt">${t}</h3><p class="small">${d}</p></div><b class="nowrap" style="font-size:10pt">${price}</b></div>`;
P('10 · Recommending', `
${sec('10', 'Recommending', 'Which package to recommend', 'Start at the top. Recommend one package, clearly, with the reason. If the owner hesitates, start the free trial first.')}
${qn('Does the shop have a working Windows computer or laptop? (Core i3, 4 GB RAM or better)')}
<div class="grid" style="grid-template-columns:1fr 2fr;gap:5mm;align-items:start">
  <div class="flow">${arrow('NO', 'no')}${qn('Ready to buy the devices now?')}${arrow('YES', 'yes')}${an('Complete Till · KES 69,900', 'Desktop, screen, UPS, scanner, printer, drawer, paper, setup, training and 12 months software.', 'var(--coral)')}${arrow('NOT YET', 'no')}${an('Free trial first', 'On any computer they can use (a home laptop is fine). Offer the Complete Till at day 21.', 'var(--sun)')}</div>
  <div class="flow">${arrow('YES', 'yes')}${qn('Do they want a scanner, receipt printer and cash drawer?')}
    <div class="grid g2" style="gap:5mm;align-items:start">
      <div class="flow">${arrow('YES', 'yes')}${an('Software + Setup + Counter Kit', 'KES 15,000 + KES 21,900 = <b>KES 36,900</b>. A full till on their own computer.', 'var(--navy)')}</div>
      <div class="flow">${arrow('NO', 'no')}${qn('Can they pay KES 15,000 now?')}${arrow('YES', 'yes')}${an('Software + Setup · KES 15,000', 'Setup, training, 300 products loaded, 12 months software.', 'var(--teal)')}${arrow('NO', 'no')}${an('Setup + monthly', '<b>KES 3,500</b> setup, then <b>KES 1,200</b> a month.', 'var(--teal)')}</div>
    </div>
  </div>
</div>
<h2 style="margin-top:2mm">Then add what the shop needs</h2>
<div class="grid g2">
  ${need('label', 'sun', 'Labels', 'Many items without barcodes: boutique, cosmetics, loose goods.', 'Label kit · 16,500')}
  ${need('battery', 'navy', 'Power', 'An extra till or the client’s own desktop, in an area with power cuts.', 'UPS · 8,500')}
  ${need('users', 'coral', 'Two counters', 'Queues at peak times and two cashiers.', 'Extra till · 44,900')}
  ${need('store', 'teal', 'Second shop', 'Another branch on the same account.', '+1,000 / month')}
</div>
${callout('info', 'Monthly or yearly?', 'Yearly (KES 12,000) is two months free. Recommend it once the owner is happy at the end of the trial. Monthly (KES 1,200) suits owners who are still unsure.')}
`, 'recommend');

/* 15 — Trial */
P('11 · Free trial', `
${sec('11', 'The 30-day free trial', 'Start it, follow it, convert it', 'The trial is where sales are won. A trial without follow-up is a lost sale.')}
<div class="tl">
  <div class="d hot"><div class="dot">D0</div><h3>Start</h3><p>Portal: <b>Start 30-day trial</b>, then <b>Send on WhatsApp</b>.</p></div>
  <div class="d"><div class="dot">D1</div><h3>Check in</h3><p>“Did you make your first sale?” Help add products.</p></div>
  <div class="d"><div class="dot">D3</div><h3>Visit</h3><p>Products loaded? Staff PINs set? Show the Home screen.</p></div>
  <div class="d"><div class="dot">D7</div><h3>Review</h3><p>Look at a week of sales together. Ask what they learned.</p></div>
  <div class="d"><div class="dot">D21</div><h3>Recommend</h3><p>Propose the package. Book hardware or setup if needed.</p></div>
  <div class="d hot"><div class="dot">D28</div><h3>Close</h3><p>Help them pay by M-Pesa Paybill before day 30.</p></div>
  <div class="d win"><div class="dot">D30</div><h3>Paid</h3><p>Lead moves to <b>Won</b>. Commission is created.</p></div>
</div>
<div class="grid g-5-7">
  <div class="stack">
    <h2>What the owner does on day 0</h2>
    ${steps([
      { t: 'Open the link in Chrome', d: `<span class="code">${CONTACT.app}</span> on the shop computer.` },
      { t: 'Sign in', d: 'With the email and password from your WhatsApp message.' },
      { t: 'Install the app', d: 'Click <b>Install app</b> in Chrome so it opens like a normal program.' },
      { t: 'Run the setup wizard', d: 'Business details, receipt, payment methods, staff PINs, products.' },
    ])}
  </div>
  <div class="stack">
    <h2>Messages that work (edit to your own words)</h2>
    <div class="msg"><b>Day 1</b> — Habari [name]! Did your first sale go well? Reply with any question. I can come and help you load your products. — [your name], Pentarch POS</div>
    <div class="msg"><b>Day 7</b> — Hi [name], one week done! Open Home and look at “Gross profit” for the week. Shall I pass by tomorrow to go through it together?</div>
    <div class="msg"><b>Day 28</b> — Hi [name], your free trial ends in 2 days. To keep selling: M-Pesa Paybill (number on the Pay screen in the app), Account: your business code ${'<span class="mono">PP</span>'}xxxxx. KES 1,200/month or 12,000/year.</div>
    ${callout('warn', 'What happens if they do not pay', 'From 7 days before the end, a banner reminds them. After day 30 there are 7 grace days with selling still allowed. Then selling stops — but the owner can still view, print reports and export. Data is never held hostage.')}
  </div>
</div>
<div class="grid g3">
  ${card(`<h3>${icon('thumb', { size: 15, color: 'var(--teal-d)' })} The trial is going well when…</h3><p class="small">sales are recorded every day · staff use their own PINs · products have prices and stock · the owner opens Home in the evening</p>`)}
  ${card(`<h3>${icon('alert', { size: 15, color: 'var(--coral-d)' })} The trial is going cold when…</h3><p class="small">no sales for 2 days · only a few products loaded · the owner stops replying. <b>Visit the same day</b> and fix the blocker.</p>`)}
  ${card(`<h3>${icon('phone', { size: 15, color: 'var(--navy)' })} Track it in the portal</h3><p class="small">Home shows <b>Active trials</b> and follow-ups due. Set the next follow-up date after every contact so nothing slips.</p>`)}
</div>
`, 'trial');

/* 16 — Closing & after */
P('12 · Closing & handover', `
${sec('12', 'Closing, payment and handover', 'Get paid the right way', 'The client pays Pentarch directly. You never touch the money.')}
<div class="grid g-7-5">
  <div class="stack">
    <h2>How the client pays</h2>
    ${table(['Step', 'On the owner’s phone'], [
      ['1', 'M-Pesa → Lipa na M-Pesa → <b>Pay Bill</b>'],
      ['2', '<b>Business no.:</b> Pentarch’s Paybill — shown on the app’s Pay screen'],
      ['3', '<b>Account no.:</b> the business code, e.g. <span class="mono">PP28152</span>'],
      ['4', '<b>Amount:</b> as quoted, then the M-Pesa PIN (the owner types it, never you)'],
      ['5', 'Forward the M-Pesa SMS to Pentarch on WhatsApp'],
    ], { cls: 'tight', align: ['c', ''], widths: ['12%', '88%'] })}
    ${callout('stop', 'Never collect cash personally', 'Not for software, not for hardware, not “to help”. Walk the owner through the Paybill instead. Collecting money means immediate removal as an agent.')}
    <h2>Closing lines</h2>
    ${dots([
      '“You told me you lose about [their number] a month. This costs 1,200. Shall we keep it running?”',
      '“Monthly or yearly? Yearly gives you two months free.”',
    ])}
  </div>
  <div class="stack">
    <h2>After the sale</h2>
    ${steps([
      { t: 'Book the installation', d: 'In the portal, use <b>Book demo</b> with a note, or WhatsApp Pentarch with the business code, date and address.', c: 'c' },
      { t: 'Confirm the product list', d: 'Ask the owner for an Excel list or photos of stock — up to 300 items are loaded in the package.' },
      { t: 'Be there at handover', d: 'Meet the installer. Introduce the owner. Agree the support contact.' },
      { t: 'Ask for referrals', d: '“Who else should see this?” Log the names the same day.', c: 't' },
    ])}
  </div>
</div>
<h2>What happens after the owner pays</h2>
${hsteps([{ t: 'Paid', d: 'Owner pays the Paybill with the business code.' }, { t: 'Recorded', d: 'Pentarch records the payment against the business.' }, { t: 'Licence', d: 'Paid-until date moves forward; the lead becomes Won.' }, { t: 'Commission', d: 'Created as Pending in your Earnings.' }, { t: 'Paid out', d: 'Approved, then sent to your M-Pesa monthly.' }], 5)}
<div class="card tint">
  <h3>${icon('checklist', { size: 15 })} Handover checklist (installer and agent together)</h3>
  ${checklist(['Owner can sign in and knows the business code', 'Staff have PINs and the right roles', 'A test sale prints a receipt; drawer opens', 'Scanner reads a product barcode', 'Products and prices checked with the owner', 'Shift open and close shown to the cashier', 'Backup and “Synced” status explained', 'Support number saved in the owner’s phone'], 'two')}
</div>
`, 'closing');

/* 17 — Commission */
P('13 · Commission', `
${sec('13', 'Your commission', 'How you earn', 'Commission is created automatically when a client you brought in pays Pentarch. It is paid to your M-Pesa monthly, once the client’s payment has cleared.')}
<div class="grid g4">
  <div class="card dark">${stat('<span class="gradtext">20%</span>', '<span style="color:#C9D1E3">of software payments for the client’s first 12 months</span>')}</div>
  ${card(stat('KES 3,000', 'per Complete Till package'))}
  ${card(stat('KES 1,500', 'per Software + Setup package'))}
  ${card(stat('KES 1,000', 'per Counter Kit'))}
</div>
<div class="grid g-7-5">
  <div>
    <h2>Worked examples</h2>
    ${table(['The client buys', 'You earn'], [
      ['Yearly subscription, KES 12,000', '20% = <b>KES 2,400</b>'],
      ['Monthly subscription, KES 1,200, pays 12 months', '20% = KES 240 a month, <b>KES 2,880</b> over the year'],
      ['Setup only (KES 3,500) + monthly KES 1,200', 'No bonus on setup; <b>KES 240</b> per month paid'],
      ['Software + Setup package, KES 15,000', '<b>KES 1,500</b> bonus'],
      ['Software + Setup + Counter Kit', 'KES 1,500 + KES 1,000 = <b>KES 2,500</b>'],
      ['Complete Till, KES 69,900', '<b>KES 3,000</b> bonus'],
    ], { align: ['', 'r'], widths: ['60%', '40%'] })}
  </div>
  <div class="stack">
    <div class="card dark">
      <h3 style="color:#fff">One good month</h3>
      <table class="tight" style="color:#C9D1E3;font-size:8.2pt">
        <tr><td style="background:none;border-color:#22305a">1 Complete Till</td><td class="r" style="background:none;border-color:#22305a">3,000</td></tr>
        <tr><td style="background:none;border-color:#22305a">2 Software + Setup</td><td class="r" style="background:none;border-color:#22305a">3,000</td></tr>
        <tr><td style="background:none;border-color:#22305a">1 Counter Kit</td><td class="r" style="background:none;border-color:#22305a">1,000</td></tr>
        <tr><td style="background:none;border-color:#22305a">4 yearly subscriptions</td><td class="r" style="background:none;border-color:#22305a">9,600</td></tr>
        <tr><td style="background:none;border-color:#22305a">6 monthly subscriptions</td><td class="r" style="background:none;border-color:#22305a">1,440</td></tr>
        <tr><td style="background:none;border:none;color:#fff;font-weight:700">Total this month (KES)</td><td class="r" style="background:none;border:none;color:var(--sun);font-weight:800;font-size:11pt">18,040</td></tr>
      </table>
      <p class="xs" style="margin-top:1.4mm">The 6 monthly clients keep paying you KES 1,440 a month for up to 12 months.</p>
    </div>
  </div>
</div>
<div class="grid g3">
  ${card(`<h3>${icon('list', { size: 15 })} The rules</h3>${dots(['The business must be started with your agent code: your trial, your demo link or a lead assigned to you.', 'The 20% counts from the client’s first software payment, for 12 months.', 'The software included in a package earns the package bonus, not the 20%.', 'Setup-only fees and paper do not earn commission.'])}`)}
  ${card(`<h3>${icon('sync', { size: 15 })} Status of each commission</h3><p class="small"><span class="chip sun">Pending</span> client paid, being checked<br><span class="chip navy" style="margin-top:1mm">Approved</span> confirmed by Pentarch<br><span class="chip teal" style="margin-top:1mm">Paid</span> sent to your M-Pesa, with the reference</p>`)}
  ${card(`<h3>${icon('alert', { size: 15 })} Disputes</h3><p class="small">If two agents claim one shop, Pentarch decides from the portal records: who logged it first and whose code started the trial. Current rates are shown under Earnings.</p>`)}
</div>
`, 'commission');

/* 18–19 — Portal */
P('14 · Agent portal', `
${sec('14', 'Using the agent portal', 'Your office in your pocket', `Open <span class="code">${CONTACT.agents}</span> in Chrome on your phone and tap <b>Install app</b> (or <b>Add to Home screen</b>). It works offline and syncs when you are back online. English and Kiswahili.`)}
<div class="grid g3" style="gap:7mm;padding:0 4mm">
  ${phone('ag-signup', '1 · Apply: name, M-Pesa phone, email, town', '100%')}
  ${phone('ag-pending', '2 · Pending: Pentarch approves within about one working day', '100%')}
  ${phone('ag-home', '3 · Home: earnings, follow-ups due, trials, wins', '100%')}
</div>
${hsteps([{ t: 'Open in Chrome', d: 'Type the portal address on your Android phone.' }, { t: 'Install', d: 'Menu ⋮ → <b>Install app</b> or <b>Add to Home screen</b>.' }, { t: 'Apply', d: 'Fill in the form and accept the agent terms.' }, { t: 'Get approved', d: 'Pentarch emails you. Tap <b>Check status</b>.' }], 4)}
<div class="grid g3">
  ${card(feat('key', 'coral', 'Your agent code', 'Shown on Home and in Profile (e.g. <span class="mono">AG-NB98</span>). Every link you share carries it.'))}
  ${card(feat('calendar', 'navy', 'Follow-ups due today', 'Home lists every lead you promised to contact today, with WhatsApp and call buttons.'))}
  ${card(feat('trophy', 'sun', 'Leaderboard', 'See how you rank this month. Only first names are shown.'))}
</div>
`, 'portal');
P('14 · Agent portal', `
<div class="grid g4" style="gap:5mm">
  ${phone('ag-lead-detail', '4 · Lead: call, WhatsApp, map, stage, log visit', '100%')}
  ${phone('ag-trial-done', '5 · Trial started: send the login on WhatsApp', '100%')}
  ${phone('ag-commissions', '6 · Earnings: pending, approved, paid', '100%')}
  ${phone('ag-offline', '7 · Offline: saved on the phone, syncs later', '100%')}
</div>
<div class="grid g2">
  <div class="stack">
    <h2>Add a lead</h2>
    ${steps([
      { t: 'Tap the red + (New lead)', d: 'Business name, contact person, phone, business type, town or area.' },
      { t: 'Capture GPS location', d: 'Tap it while you are in the shop, so you and the installer can find it again.' },
      { t: 'Choose the interest and the stage', d: 'Complete Till, Software only or Not sure yet. Set the next follow-up date.' },
      { t: 'Save', d: 'If the phone number is already a lead or a client, the portal warns you.' },
    ])}
  </div>
  <div class="stack">
    <h2>Work the lead</h2>
    ${steps([
      { t: 'Log every contact', d: '<b>Log visit</b>, <b>Log call</b> or <b>Add note</b>, with the next follow-up date.' },
      { t: 'Share the demo', d: '<b>Share demo link</b> sends the demo with your code to the owner on WhatsApp.' },
      { t: 'Start the trial', d: '<b>Start 30-day trial</b> creates the account and a ready WhatsApp message with the login.', c: 'c' },
      { t: 'Move the stage', d: 'New → Contacted → Demo booked → Demo done → On trial → Won or Lost (give the reason).', c: 't' },
    ])}
  </div>
</div>
<h2>Lead stages</h2>
<div style="display:flex;align-items:center;gap:1.5mm;flex-wrap:nowrap">${[['New','line'],['Contacted','navy'],['Demo booked','sun'],['Demo done','sun'],['On trial','coral'],['Won','teal']].map(([t,c2],i)=>`${i?icon('arrow',{size:12,color:'var(--mute)'}):''}<span class="chip ${c2}" style="font-size:8.6pt;padding:1mm 3mm">${t}</span>`).join('')}</div>
<p class="small mute" style="margin-top:-1.4mm">A lead can move to <span class="chip line">Lost</span> at any stage. Always give the reason, so Pentarch learns why.</p>
${callout('tip', 'Resources tab', 'Under <b>More → Resources</b> you will find this guide, the price list, the demo script, objection answers, FAQs and the product one-pager. Share the price list straight from your phone.')}
`, 'portal2');

/* 20 — Conduct */
P('15 · Code of conduct', `
${sec('15', 'Code of conduct', 'How a Pentarch agent works', 'You represent Pentarch in every shop you enter. These rules protect the clients, Pentarch and your income.')}
<div class="grid g2">
  ${card(`<h2 style="color:var(--teal-d)">${icon('check', { size: 16 })} Always</h2>${ticks([
    'Tell the truth about features, prices and timelines.',
    'Check any feature in the live demo before you promise it.',
    'Quote the published prices exactly.',
    'Let the client pay Pentarch directly by M-Pesa Paybill.',
    'Ask permission before taking photos or GPS in a shop.',
    'Keep client information private. Use it only for Pentarch work.',
    'Arrive on time; call ahead if you will be late.',
    'Dress smart-casual and carry your agent ID.',
    'Log every visit honestly in the portal.',
  ])}`)}
  ${card(`<h2 style="color:var(--coral-d)">${icon('x', { size: 16 })} Never</h2>${ticks([
    'Say “eTIMS certified” or “KRA approved” before Pentarch announces it.',
    'Promise features, discounts, free months or delivery dates that Pentarch has not published.',
    'Collect cash or M-Pesa to your own number.',
    'Ask for or write down an owner’s passwords or M-Pesa PIN.',
    'Copy, share or sell a client’s sales, stock or customer data.',
    'Run down competitors or other agents.',
    'Register a business without the owner’s agreement.',
    'Put fake leads, visits or trials in the portal.',
    'Pressure an owner who has said no.',
  ], 'cross')}`)}
</div>
<div class="grid g3">
  ${callout('info', 'Respect customer data', 'Trial logins go only to the owner. After you send the WhatsApp message, the password is the owner’s business — do not keep it.', 'lock')}
  ${callout('warn', 'Mistakes happen', 'If you told a client something wrong, tell Pentarch the same day. We will fix it with the client together.', 'alert')}
  ${callout('stop', 'Breaking the rules', 'Pentarch may suspend your portal account and cancel unpaid commission for fake records, cash collection or false promises.', 'ban')}
</div>
<p class="small">Handle every client’s personal data as Kenya’s Data Protection Act, 2019 requires: collect only what you need, use it only for Pentarch POS, and never share it.</p>
<div class="card" style="border:1.5px dashed var(--navy)">
  <h3>${icon('file', { size: 15 })} Agent declaration</h3>
  <p class="small">I have read this guide and the agent terms. I will follow this code of conduct.</p>
  <div class="grid g4" style="margin-top:3mm;gap:6mm">
    <div><div class="sig"></div><div class="xs mute">Full name</div></div>
    <div><div class="sig"></div><div class="xs mute">Agent code</div></div>
    <div><div class="sig"></div><div class="xs mute">Signature</div></div>
    <div><div class="sig"></div><div class="xs mute">Date</div></div>
  </div>
</div>
`, 'conduct');

/* 21 — FAQ */
const faq = (q, a) => `<div style="break-inside:avoid;padding:2.4mm 0;border-bottom:1px solid var(--line)"><h3 style="font-size:9.4pt">${q}</h3><p class="small">${a}</p></div>`;
P('16 · FAQ', `
${sec('16', 'Questions agents ask', 'FAQ')}
<div style="columns:2;column-gap:8mm">
  ${faq('Do I need a laptop to sell?', 'No. The demo and the portal both run on your phone in Chrome. A laptop helps for bigger demos but is not required.')}
  ${faq('Can the owner start a trial without me?', 'Yes, at <span class="mono">…/pos/?trial=1</span>. To be credited, start it in your portal, or send <span class="mono">…/pos/?trial=1&amp;ref=</span> with your agent code.')}
  ${faq('Can the trial be extended?', 'Only Pentarch can extend a trial. If the owner needs more time for a good reason, WhatsApp support with the business code.')}
  ${faq('Can I give a discount?', 'No. Only the published prices. The yearly plan already gives two months free.')}
  ${faq('Does it work on a phone or tablet?', 'Yes, the app opens on phones and tablets in Chrome, which is how owners check sales away from the shop. The full till with printer and drawer is set up on a Windows computer.')}
  ${faq('Can two cashiers sell at the same time?', 'Yes, on two computers in the same branch. Devices are unlimited in one branch; the Extra till add-on supplies the second set of hardware.')}
  ${faq('What if the owner already has a Windows PC with a printer?', 'Sell Software + Setup. Pentarch checks whether their printer works; if not, add the Counter Kit.')}
  ${faq('Does M-Pesa money go to Pentarch?', 'No. The shop’s customers pay to the shop’s own till or paybill. Only Pentarch POS subscriptions and packages are paid to Pentarch.')}
  ${faq('What does “refurbished” mean in the Complete Till?', 'A used business-grade HP computer and screen, cleaned, tested and sold with a supplier warranty. These office machines are built to run all day for years.')}
  ${faq('Does it work for restaurants and bars?', 'Yes. Tables, kitchen and bar tickets, an optional kitchen screen, split and merged bills, takeaway and delivery. Waiters can take orders on a tablet or phone; a cashier or manager approves payment unless the owner allows waiters to take it.')}
  ${faq('Can the shop manage suppliers and deliveries?', 'Yes. Purchase orders, receive goods (with batches, expiry or serials), pay suppliers, returns, and supplier balances. Stock counts and transfers between branches too.')}
  ${faq('Can the client import their products from Excel?', 'Yes. Products can be imported from a CSV/Excel file. The setup packages include loading up to 300 items.')}
  ${faq('When am I paid?', 'Monthly, to the M-Pesa number in your profile, once the client’s payment has cleared and Pentarch has approved the commission.')}
  ${faq('What if a client cancels?', 'Commission is only created for payments the client has made and that have cleared. Pentarch decides any refund case and will explain it to you.')}
  ${faq('Can the owner see sales from home?', 'Yes. Once the shop computer has synced, the owner can sign in from a phone or another computer to check sales, stock and debtors.')}
  ${faq('What does the owner need for the trial?', 'A computer with Google Chrome, an email address and a phone number. A printer is optional — receipts can also be sent on WhatsApp.')}
  ${faq('What if the shop has thousands of products?', 'Products load from Excel. Loading beyond 300 items is KES 2,000 per extra 500 items, or the owner can import the file themselves.')}
  ${faq('Who gives support after the sale?', `Pentarch, by WhatsApp and phone (${CONTACT.phone}), Monday to Saturday, 8am to 6pm. You stay the friendly face — pass problems to support quickly.`)}
</div>
`, 'faq');

/* 22 — Cheat sheet */
P('17 · Cheat sheet', `
<div class="row" style="justify-content:space-between;align-items:flex-end"><div>${sec('17', 'Keep this on your phone', 'Cheat sheet')}</div><div class="xs mute" style="text-align:right">Demo <span class="mono" style="color:var(--text)">${CONTACT.demo}</span><br>Portal <span class="mono" style="color:var(--text)">${CONTACT.agents}</span></div></div>
<div class="grid g2">
  <div class="card dark" style="padding:3.4mm 4mm">
    <div class="kicker" style="color:var(--sun);margin-bottom:1mm">The pitch in 4 lines</div>
    <p class="small" style="color:#fff">1. Pentarch POS stops the losses you cannot see.<br>2. Scan or tap, take cash, M-Pesa or credit, print a receipt.<br>3. Works offline. Staff PINs record everything. Kiswahili.<br>4. KES 1,200 a month. Free for 30 days. May I show you?</p>
  </div>
  <div class="card" style="padding:3.4mm 4mm;border-top:3px solid var(--teal)">
    <div class="kicker" style="color:var(--teal-d);margin-bottom:1mm">Kwa Kiswahili</div>
    <p class="small" style="color:var(--text)">1. Pentarch POS inazuia hasara ambazo huzioni.<br>2. Scan au gusa bidhaa, pokea cash, M-Pesa au deni, printi risiti.<br>3. Inafanya kazi bila internet. Kila mfanyakazi ana PIN yake.<br>4. KES 1,200 kwa mwezi. Bure siku 30. Nikuonyeshe?</p>
  </div>
</div>
${table(['Prices (KES)', '', ''], [
  ['Subscription', '<b>1,200</b>/month or <b>12,000</b>/year', 'Extra branch +1,000/month or 10,000/year'],
  ['Software + Setup', '<b>15,000</b> incl. 12 months', 'or 3,500 setup + 1,200/month'],
  ['Complete Till', '<b>69,900</b> incl. 12 months', 'Desktop, screen, UPS, scanner, printer, drawer, paper, install, training'],
  ['Add-ons', 'Counter Kit <b>21,900</b> · Labels <b>16,500</b> · UPS <b>8,500</b>', 'Extra till <b>44,900</b> · Paper carton <b>7,000</b> · +500 items <b>2,000</b>'],
], { cls: 'tight', widths: ['18%', '40%', '42%'] })}
${table(['Objection', 'One-line answer'], [
  ['I use a book', 'The book shows what was written; this shows what was sold, profit and debts.'],
  ['Too expensive', 'KES 40 a day, and the first 30 days are free.'],
  ['No internet', 'It works fully offline and backs up when internet returns.'],
  ['Staff can’t use computers', 'If they can use M-Pesa, they can use this. Kiswahili screens, training included.'],
  ['KRA / eTIMS?', 'KRA PIN and tax codes on receipts now; full eTIMS pending KRA certification.'],
  ['Computer breaks', 'Cloud backup; sign in on another computer. Warranty and UPS on Complete Till.'],
  ['M-Pesa?', 'Yes — code entry with checks; STK prompt possible on the shop’s own till.'],
  ['Tried a POS before', 'What failed? Test this one free for 30 days.'],
  ['Data safety', 'Separate data, PINs, roles, backups. Your data is never locked away.'],
  ['I’ll think about it', 'Think while using it — the trial is free and nothing to cancel.'],
  ['Techlion / Uzapoint', 'Same price as Techlion, plus free trial, demo, offline, Kiswahili, local support.'],
  ['No computer', 'Complete Till, KES 69,900: desktop, screen, UPS and all devices.'],
], { cls: 'tight fit', widths: ['26%', '74%'] })}
<div class="grid g4">
  <div class="card tint"><div class="xs mute">Trial follow-up</div><div class="small"><b>D0</b> start · <b>D1</b> first sale? · <b>D3</b> visit · <b>D7</b> review · <b>D21</b> recommend · <b>D28</b> pay</div></div>
  <div class="card tint"><div class="xs mute">Payment</div><div class="small"><b>M-Pesa Paybill</b> · Account = business code <span class="mono">PPxxxxx</span>. Never collect cash.</div></div>
  <div class="card tint"><div class="xs mute">Support</div><div class="small"><b>${CONTACT.phone}</b> · Mon–Sat 8am–6pm<br>${CONTACT.email}</div></div>
  <div class="card tint"><div class="xs mute">Commission</div><div class="small"><b>20%</b> software, 12 months · Till <b>3,000</b> · Setup <b>1,500</b> · Kit <b>1,000</b></div></div>
</div>
`, 'cheat');

export default { title: 'Pentarch POS — Sales Agent Guide', short: 'Pentarch POS · Sales Agent Guide', pages };
