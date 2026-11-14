import { icon, mark, CONTACT } from '../lib.mjs';

const pages = [];
const P = (secName, html, key) => pages.push({ sec: secName, html, key, cls: 'pl' });

const CSS = `<style>
.pl .content{gap:4.2mm}
.pl h1{font-size:28pt;font-weight:800;line-height:1.02}
.pl .sw{color:var(--teal-d);font-style:italic}
.pl .big{font-size:12.6pt;line-height:1.45;color:var(--body)}
.pkr{display:grid;grid-template-columns:1fr auto;gap:3mm 4mm;align-items:start;border:1px solid var(--line);border-radius:14px;padding:4mm 5mm;background:#fff}
.pkr.hero{border:2.5px solid var(--coral);background:#fff}
.pkr .nm{font-family:'Bricolage Grotesque';font-weight:800;font-size:16pt;color:var(--text);line-height:1.1}
.pkr .who{font-size:11pt;color:var(--mute);margin-top:.6mm}
.pkr .pr{text-align:right}
.pkr .pr .v{font-family:'Bricolage Grotesque';font-weight:800;font-size:24pt;color:var(--text);line-height:1;white-space:nowrap}
.pkr .pr .u{font-size:9.6pt;font-weight:700;color:var(--mute);text-transform:uppercase;letter-spacing:.05em;margin-top:1mm}
.pkr ul{grid-column:1/3;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;font-size:10.8pt;color:var(--text)}
.pkr li{display:flex;gap:2.2mm;align-items:flex-start}
.pkr li .ic{color:var(--teal-d);flex:none;margin-top:.8mm}
.pkr .tag{display:inline-block;background:var(--coral-d);color:#fff;font-size:8.6pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-radius:999px;padding:.6mm 3mm;margin-bottom:1.6mm}
.trial{background:var(--ink);border-radius:14px;padding:5mm 6mm;color:#C9D1E3;display:grid;grid-template-columns:1fr auto;gap:5mm;align-items:center}
.trial .t{font-family:'Bricolage Grotesque';font-weight:800;font-size:20pt;color:#fff;line-height:1.1}
.trial .free{font-family:'Bricolage Grotesque';font-weight:800;font-size:30pt;color:var(--sun);line-height:1;text-align:right}
.adds{border:1px solid var(--line);border-radius:14px;overflow:hidden}
.adds .r{display:grid;grid-template-columns:1fr auto;gap:4mm;padding:3.2mm 5mm;border-bottom:1px solid var(--line);font-size:11.6pt;align-items:center}
.adds .r:last-child{border-bottom:none}
.adds .r b.p{font-family:'Bricolage Grotesque';font-size:14pt;white-space:nowrap}
.adds .r .d{font-size:10pt;color:var(--mute)}
.pay{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm}
.pay .s{background:var(--paper);border-radius:12px;padding:3.6mm;font-size:11pt;color:var(--text)}
.pay .s .n{font-family:'JetBrains Mono';font-weight:700;color:var(--coral-d);font-size:10pt;display:block;margin-bottom:1mm}
</style>`;
const li = (t) => `<li>${icon('check', { size: 15, stroke: 2.6 })}<span>${t}</span></li>`;
const pk = (name, who, price, unit, items, hero = false) => `<div class="pkr ${hero ? 'hero' : ''}"><div>${hero ? '<span class="tag">Everything included</span>' : ''}<div class="nm">${name}</div><div class="who">${who}</div></div><div class="pr"><div class="v">${price}</div><div class="u">${unit}</div></div><ul>${items.map(li).join('')}</ul></div>`;

P('Price list', `${CSS}
<div><div class="kicker" style="margin-bottom:2mm">Price list · November 2026 · prices in Kenyan shillings</div>
<h1>Pentarch POS</h1>
<p class="big" style="margin-top:1.6mm">A till system for Kenyan businesses. Works without internet. Selling, stock and purchases, 24 reports, restaurant tables, salon commission, quotes and invoices: all included. <span class="sw">Mfumo wa kuuza unaofanya kazi hata bila internet.</span></p></div>
<div class="trial"><div><div class="t">Try it free for 30 days</div><div style="font-size:11.4pt;margin-top:1mm">Full system on your own computer. No card, no deposit. Start at <b style="color:#fff">pentarchcommunications.com/pos/?trial=1</b>. <span style="font-style:italic;color:#8FE0DC">Jaribu bure kwa siku 30.</span></div></div><div class="free">KES 0</div></div>
${pk('Software only', 'After the free trial, on your own computer', 'KES 1,200', 'per month', ['Or <b>KES 12,000 a year</b> — 2 months free', 'Unlimited products, users, devices', 'Cloud backup, sync and updates', 'WhatsApp support Mon–Sat, 8am–6pm', 'Extra branch: <b>+KES 1,000 a month</b>', 'English and Kiswahili'])}
${pk('Software + Setup', 'You have a Windows computer or laptop', 'KES 15,000', 'one-off', ['<b>12 months of software included</b>', 'Installation, on site or remote', 'Staff training', 'Up to 300 products loaded for you', 'Monthly option: <b>3,500 setup + 1,200/month</b>', 'Needs Core i3, 4 GB RAM and Chrome'])}
${pk('Complete Till', 'Everything you need to sell from day one', 'KES 69,900', 'one price', ['HP mini desktop, 19-inch screen, keyboard, mouse', 'UPS backup power for blackouts', 'Barcode scanner (reads phone screens)', '80 mm receipt printer and cash drawer', 'Delivery, setup, training for 3 staff', '300 products loaded, 10 paper rolls', '<b>12 months of software included</b>'], true)}
`, 'p1');

P('Price list', `${CSS}
<div><div class="kicker" style="margin-bottom:2mm">Add-ons · Vifaa vya ziada</div><h1 style="font-size:24pt">Add what your shop needs</h1></div>
<div class="adds">
  <div class="r"><div><b>Counter Kit</b><div class="d">Scanner, receipt printer, cash drawer, 10 rolls, installed — for your own computer</div></div><b class="p">KES 21,900</b></div>
  <div class="r"><div><b>Extra till</b><div class="d">Second mini desktop, 19-inch screen, keyboard and mouse, scanner and printer, same branch, installed</div></div><b class="p">KES 44,900</b></div>
  <div class="r"><div><b>Label printer kit</b><div class="d">Xprinter XP-470B and 2 rolls of 40 × 30 mm price labels, set up</div></div><b class="p">KES 16,500</b></div>
  <div class="r"><div><b>Extra UPS</b><div class="d">Mercury Elite 650 Pro backup power</div></div><b class="p">KES 8,500</b></div>
  <div class="r"><div><b>Receipt paper carton</b><div class="d">50 rolls, 80 × 80 mm</div></div><b class="p">KES 7,000</b></div>
  <div class="r"><div><b>Extra product loading</b><div class="d">Beyond the 300 items included, per 500 items</div></div><b class="p">KES 2,000</b></div>
</div>
<div><h2 style="font-size:15pt">How to pay · Jinsi ya kulipa</h2>
<div class="pay">
  <div class="s"><span class="n">01</span>M-Pesa → Lipa na M-Pesa → <b>Pay Bill</b></div>
  <div class="s"><span class="n">02</span><b>Business no.:</b> Pentarch’s Paybill, shown in the app</div>
  <div class="s"><span class="n">03</span><b>Account no.:</b> your business code, e.g. <span class="mono">PP28152</span></div>
  <div class="s"><span class="n">04</span>Enter the amount and your PIN. Keep the SMS.</div>
</div>
<p class="big" style="margin-top:2mm;font-size:11pt"><b>Pay Pentarch only by Paybill.</b> Our agents never collect cash. <span class="sw">Usimpe wakala pesa taslimu.</span></p></div>
<div class="grid g2">
  <div class="card tint"><h3 style="font-size:12pt">Good to know</h3><ul class="dots" style="font-size:10.4pt">
    <li>Free delivery and installation in Nairobi; outside Nairobi, transport at cost.</li>
    <li>Devices: 6 to 12-month supplier warranty; Pentarch handles claims.</li>
    <li>Your data is yours: export it any time.</li>
    <li>KRA PIN and tax codes print on receipts. Full eTIMS is planned, pending KRA certification.</li>
  </ul></div>
  <div class="card dark" style="display:flex;flex-direction:column;gap:1.6mm"><h3 style="font-size:12pt">Talk to us</h3>
    <div style="font-size:11pt;display:flex;gap:2.4mm;align-items:center">${icon('call', { size: 17, color: 'var(--sun)' })}<b>${CONTACT.phone}</b></div>
    <div class="xs" style="margin:-1mm 0 0 7mm">phone and WhatsApp · Mon–Sat 8am–6pm</div>
    <div style="font-size:10.4pt;display:flex;gap:2.4mm;align-items:center">${icon('mail', { size: 16, color: 'var(--sun)' })}${CONTACT.email}</div>
    <div style="font-size:10.4pt;display:flex;gap:2.4mm;align-items:center">${icon('globe', { size: 16, color: 'var(--sun)' })}<span>Live demo: pentarchcommunications.com<wbr>/pos/?demo=1</span></div>
    <div style="font-size:10.4pt;display:flex;gap:2.4mm;align-items:center">${icon('star', { size: 16, color: 'var(--sun)' })}<span>Free trial: pentarchcommunications.com<wbr>/pos/?trial=1</span></div>
  </div>
</div>
<p class="xs mute">Prices valid from 9 November 2026 and may change. Pentarch Communications, Nairobi.</p>
`, 'p2');

export default { title: 'Pentarch POS — Price List', short: 'Pentarch POS · Price list', pages };
