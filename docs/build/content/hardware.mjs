import { mk, shotA, shotC, monitor, monitorA, qs, sec, callout, table, feat, card, steps, hsteps, checklist, ticks, dots, chip, stat, icon, cover, CONTACT } from '../lib.mjs';

const pages = [];
const P = (secName, html, key, cls = '') => pages.push({ sec: secName, html, cls, key });
const Y = `<span style="color:var(--teal-d)">${icon('check', { size: 15, stroke: 2.6 })}</span>`;
const N = '<span class="mute">—</span>';
const url = (u) => `<span class="mono" style="font-size:7pt;color:var(--navy);word-break:break-all">${u}</span>`;
const IC = (ic, t) => `<span style="display:inline-flex;gap:6px;align-items:center;font-weight:700;color:var(--text)">${icon(ic, { size: 14 })}${t}</span>`;

/* 1 — Cover */
pages.push({ bare: true, cls: 'cover', html: cover({
  kicker: 'For Pentarch installers and sales agents',
  title: 'Pentarch POS<br><span style="color:var(--sun)">Hardware &amp; Setup Guide</span>',
  tag: 'Which devices to buy, how to connect them, how to set up a till step by step, and what to do when something does not work.',
  art: `<div style="width:150mm">${monitor('duka-tender-cash', '', '132mm')}</div>`,
  meta: [['Covers', 'Complete Till · Software + Setup · add-ons'], ['Prices checked', '9 November 2026'], ['Support', CONTACT.phone]],
}) });

/* 2 — Packages matrix */
P('01 · Devices per package', `
${sec('01', 'Devices per package', 'What goes into each package', 'The Complete Till is a small refurbished HP desktop with a 19-inch screen, backup power and the counter devices.')}
${table(['Item', 'Model', 'Complete Till', 'Software + Setup', 'Counter Kit', 'Extra till'], [
  [IC('minipc', 'Computer'), 'HP EliteDesk 800 G2 Mini, refurbished. Core i5 6th gen, 8 GB RAM, 256 GB SSD, Windows 10/11 Pro', Y, 'Client’s own', N, Y],
  [IC('monitor', 'Screen'), 'HP 19-inch monitor, refurbished (P19b / EliteDisplay class)', Y, 'Client’s own', N, Y],
  [IC('keyboard', 'Keyboard &amp; mouse'), 'USB wired combo (HP or Logitech MK120 class)', Y, 'Client’s own', N, Y],
  [IC('battery', 'Backup power'), 'Mercury Elite 650 Pro UPS, 650 VA', Y, N, N, '<span class="xs">add-on</span>'],
  [IC('scan', 'Barcode scanner'), 'Syble XB-6221, 2D, wired USB', Y, N, Y, Y],
  [IC('printer', 'Receipt printer'), 'Xprinter XP-Q80A, 80 mm, auto-cutter, USB + LAN', Y, N, Y, Y],
  [IC('drawer', 'Cash drawer'), 'OCOM ECD-420X, metal, 5 notes / 8 coins, RJ11', Y, N, Y, N],
  [IC('receipt', 'Receipt paper'), '80 × 80 mm thermal rolls', '10 rolls', N, '10 rolls', N],
  [IC('settings', 'Installation'), 'On site (Nairobi) or remote; up to 300 products loaded', Y, Y, Y, Y],
  [IC('users', 'Training'), 'Up to 3 staff', Y, Y, N, N],
  [IC('cloud', 'Software'), 'Pentarch POS licence', '12 months', '12 months', N, 'Same licence'],
], { cls: 'tight', align: ['', '', 'c', 'c', 'c', 'c'], widths: ['19%', '37%', '11%', '12%', '10%', '11%'] })}
<p class="small"><b>Add-ons:</b> label printer kit (Xprinter XP-470B + 2 rolls of 40 × 30 mm labels) and an extra Mercury Elite 650 Pro UPS for an extra till or a client’s own desktop. <b>Restaurants, optional:</b> a kitchen screen and waiter tablets (page {{p:kitchen}}), quoted by Pentarch.</p>
<div class="card tint" style="display:flex;gap:3mm;align-items:center;flex-wrap:wrap"><b style="color:var(--text)">Minimum computer for Software + Setup:</b>${chip('Core i3 or better', 'ink')}${chip('4 GB RAM (8 GB better)', 'ink')}${chip('Windows 10 or 11', 'ink')}${chip('Latest Google Chrome', 'ink')}${chip('Desktop or laptop', 'line')}</div>
${callout('info', 'Check the client’s computer before you quote', 'Open Settings → System → About. Note the processor, RAM and Windows edition. A computer with an SSD is fast; an old hard disk feels slow. If it struggles, recommend the Complete Till. A laptop is fine for Software + Setup.')}
`, 'packages');

/* 3 — Device list & where to buy */
const dev = (ic, name, model, why, price, where) => [`${IC(ic, name)}<div class="xs mute" style="margin-top:.6mm">${model}</div>`, `<span class="small">${why}</span>`, `<b class="nowrap">${price}</b>`, where.map(([s, p, u]) => `<div class="small" style="margin-bottom:.9mm"><b>${s}</b> · ${p}${u ? `<br>${url(u)}` : ''}</div>`).join('')];
P('02 · Buying the devices', `
${sec('02', 'Buying the devices · internal', 'Models, budget and sellers', 'Budget = what Pentarch plans to pay per item, checked 9 November 2026. “ex VAT” means 16% VAT is added. Prices move: check on the day. <b>Internal page: do not share buying prices with clients.</b>')}
${table(['Device', 'Why this one', 'Budget (KES)', 'Where to buy'], [
  dev('minipc', 'Mini desktop', 'HP EliteDesk 800 G2 Mini, i5-6th gen, 8 GB, 256 GB SSD', 'Cheapest reliable PC. Fast enough for Chrome. Tiny, silent, about 35 W. Fits behind the screen.', '15,000', [['Jiji', '14,000–18,000'], ['Jumia (G3 Mini)', '17,000, 6-month warranty']]),
  dev('monitor', '19-inch screen', 'HP P19b / EliteDisplay class, refurbished', 'Office-grade screen. Check it has VGA or DisplayPort.', '4,000', [['Jiji', '3,300–4,500'], ['Jumia (23-inch option)', 'HP E231 at 6,899']]),
  dev('keyboard', 'Keyboard &amp; mouse', 'USB wired combo', 'Wired: no batteries to run out.', '800', [['Any computer shop', 'about 800']]),
  dev('battery', 'UPS', 'Mercury Elite 650 Pro, 650 VA / 390 W', 'Runs PC, screen and printer for about 15–20 minutes in a blackout. Stops surges.', '6,500', [['TDK', '6,200 ex VAT', 'tdk.co.ke/?p=53613'], ['Rapidtech', '6,500 ex VAT', 'rapidtech.co.ke']]),
  dev('scan', 'Barcode scanner', 'Syble XB-6221, 2D, wired USB', 'Reads barcodes, QR codes and phone screens. No driver.', '3,000', [['Jiji', '2,900–3,000'], ['Almiria (XB-6255M)', '3,500 ex VAT', 'almiria.co.ke']]),
  dev('printer', 'Receipt printer', 'Xprinter XP-Q80A, 80 mm, USB + LAN', 'Standard Kenyan POS printer. Windows driver. Drawer port.', '6,000', [['Jiji', '5,500–6,500'], ['Onside Tech', '7,500 ex VAT', 'onsidetechsolutions.co.ke/?p=20772']]),
  dev('drawer', 'Cash drawer', 'OCOM ECD-420X, 5 notes / 8 coins, RJ11', 'Metal, key lock. Opens from the printer’s drawer port.', '5,300', [['Jiji', '4,999–5,500'], ['Rondamo (EPOS ECH-410)', '8,000, heavier', 'rondamo.co.ke']]),
  dev('receipt', 'Receipt paper', '80 × 80 mm thermal', 'Buy by the carton: about KES 120 a roll.', '1,300 / 10', [['Homelink', '5,999 per carton of ~50', 'homelink.co.ke']]),
  dev('label', 'Label printer', 'Xprinter XP-470B, USB (add-on)', 'No ribbon. Price stickers up to courier labels. Labels: 40 × 30 mm, ~700 a roll.', '12,600 + 700 / roll', [['Jumia', '12,580'], ['Onside Tech', '12,499 ex VAT'], ['Skywave (labels)', '700 a roll', 'skywave.co.ke']]),
], { cls: 'tight fit', widths: ['22%', '30%', '11%', '37%'] })}
<div class="card tint" style="display:flex;gap:6mm;align-items:center"><div class="grow small"><b>Complete Till hardware budget:</b> 15,000 + 4,000 + 800 + 6,500 + 3,000 + 6,000 + 5,300 + 1,300 = <b>KES 41,900</b>. The client pays KES 69,900, which also covers delivery, setup, training and 12 months of software.</div></div>
`, 'buy');

/* 4 — Buying safely */
P('02 · Buying the devices', `
${sec('02', 'Buying safely · internal', 'Jiji, shops and testing on collection', 'Jiji often has the lowest prices. Shops give receipts and warranty. Either way, test every device before you pay.')}
${callout('warn', 'The buying rule', 'Buy on Jiji only from sellers with <b>Verified ID</b> and <b>3+ years on Jiji</b>, or from shops that give a <b>written warranty</b>. Meet at the seller’s shop, not on the street. <b>Test every device on collection.</b> Pay by M-Pesa to the business, never cash to a stranger. Client prices stay as published.', 'alert')}
<div class="grid g2">
  ${card(`<h3>${icon('minipc', { size: 16 })} Mini desktop</h3>${checklist(['Power adapter included (HP 65 W). Starts without beeps or errors', 'Windows 10 or 11 <b>Pro</b>, activated (Settings → Activation)', 'Settings → About: Core i5 6th gen or newer, 8 GB RAM, 256 GB SSD', 'Video port matches the screen: DisplayPort, or VGA if fitted', '<b>Wi-Fi present?</b> Many minis have none. If not, budget a USB Wi-Fi adapter (about KES 1,000) or use a LAN cable', 'All USB ports work. No rattles, no burnt smell'])}`)}
  ${card(`<h3>${icon('monitor', { size: 16 })} Screen</h3>${checklist(['Power cable and video cable included', 'Full white and full black screen: no dead pixels, lines or dark corners', 'Stand is firm; buttons work', 'If the ports do not match the PC, buy a DisplayPort-to-VGA or DisplayPort-to-HDMI adapter'])}`)}
  ${card(`<h3>${icon('printer', { size: 16 })} Receipt printer and drawer</h3>${checklist(['Hold FEED while switching on: it prints a self-test page', 'Auto-cutter cuts cleanly', 'USB cable and power adapter included', 'Drawer: two keys, RJ11 cable included, opens from the printer test'])}`)}
  ${card(`<h3>${icon('scan', { size: 16 })} Scanner and UPS</h3>${checklist(['Scanner types a barcode into Notepad and jumps to a new line', 'Scanner reads a QR code from a phone screen', 'UPS: switch on, unplug from the wall — it beeps and keeps a lamp or phone charger running', 'Keep every receipt; note serial numbers in the client file'])}`)}
</div>
<div class="grid g2">
  ${callout('info', 'Windows 10 on 6th-gen PCs', '6th-gen PCs usually come with Windows 10 Pro (Windows 11 does not officially support them). Pentarch POS runs well on it. Keep the till for selling only — see page {{p:health}}.')}
  ${callout('tip', 'Why a mini desktop and not a laptop?', 'It is the cheapest reliable computer, it has no battery to wear out or swell, and it sits out of sight behind the screen. The UPS does the job a laptop battery would do.')}
</div>
`, 'safe');

/* 5 — Connection diagram */
const box = (x, y, w, h, ic, title, sub, color = 'var(--ink)', dashed = false, plug = false) => `<div style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;background:#fff;border:${dashed ? '1.5px dashed' : '1.5px solid'} ${color};border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:.8mm;padding:2mm">${plug ? `<span style="position:absolute;top:-2.4mm;left:-2.4mm;width:6mm;height:6mm;border-radius:50%;background:var(--sun);display:flex;align-items:center;justify-content:center;z-index:3">${icon('plug', { size: 12, color: '#0A1530', stroke: 2.2 })}</span>` : ''}${icon(ic, { size: 24, color })}<div style="font-family:'Bricolage Grotesque';font-weight:700;color:var(--text);font-size:9.4pt;line-height:1.15">${title}</div><div class="xs mute" style="line-height:1.25">${sub}</div></div>`;
const lab = (x, y, t, c = 'var(--ink)') => `<div style="position:absolute;left:${x}mm;top:${y}mm;transform:translate(-50%,-50%);background:${c};color:#fff;font:700 7pt 'JetBrains Mono';padding:.6mm 1.6mm;border-radius:4px;white-space:nowrap;z-index:2">${t}</div>`;
P('03 · Connections', `
${sec('03', 'Connection diagram', 'How everything connects', 'Everything plugs into the mini PC by USB, except the screen and the cash drawer. The drawer plugs into the printer. Power for the PC, screen and printer comes from the UPS.')}
<div style="position:relative;height:150mm;background:var(--paper);border-radius:12px;border:1px solid var(--line)">
  <svg style="position:absolute;inset:0" width="100%" height="100%" viewBox="0 0 180 150" preserveAspectRatio="none">
    <g fill="none" stroke-width=".7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M90 33 V54" stroke="#1F3C7A"/>
      <path d="M45 52 H55 V62 H66" stroke="#0A1530"/>
      <path d="M45 86 H55 V74 H66" stroke="#0A1530"/>
      <path d="M47 127 H60 V84 H66" stroke="#1F3C7A" stroke-dasharray="2 1.4"/>
      <path d="M114 64 H135" stroke="#0A1530"/>
      <path d="M156 74 V92" stroke="#C9301F"/>
      <path d="M114 57 H125 V18 H135" stroke="#0A7F7B" stroke-dasharray="1.6 1.4"/>
      <path d="M90 113 V86" stroke="#B97A00" stroke-width="1"/>
    </g>
  </svg>
  ${box(68, 5, 44, 28, 'monitor', '19-inch screen', 'HP, refurbished', 'var(--navy)', false, true)}
  ${box(66, 54, 48, 32, 'minipc', 'Mini PC', 'EliteDesk 800 G2 Mini · Windows · Chrome · Pentarch POS', 'var(--ink)', false, true)}
  ${box(7, 40, 38, 24, 'keyboard', 'Keyboard &amp; mouse', 'USB', 'var(--ink)')}
  ${box(7, 74, 38, 24, 'scan', 'Barcode scanner', 'USB · types like a keyboard', 'var(--ink)')}
  ${box(135, 48, 40, 26, 'printer', 'Receipt printer', 'XP-Q80A · USB', 'var(--ink)', false, true)}
  ${box(135, 92, 40, 26, 'drawer', 'Cash drawer', 'RJ11 into the printer’s DK port', 'var(--coral-d)')}
  ${box(135, 6, 40, 24, 'wifi', 'Wi-Fi or phone hotspot', 'For backup and sync only', 'var(--teal-d)', true)}
  ${box(7, 114, 40, 28, 'label', 'Label printer', 'Optional · XP-470B · USB', 'var(--navy)', true)}
  ${box(64, 113, 52, 31, 'battery', 'UPS · Mercury Elite 650 Pro', 'Wall socket → UPS → PC, screen, printer', 'var(--sun-d)')}
  ${lab(90, 43, 'DisplayPort / VGA', 'var(--navy)')}
  ${lab(50, 52, 'USB')}
  ${lab(50, 86, 'USB')}
  ${lab(53, 127, 'USB', 'var(--navy)')}
  ${lab(125, 64, 'USB')}
  ${lab(156, 83, 'RJ11', 'var(--coral-d)')}
  ${lab(125, 38, 'Wi-Fi', 'var(--teal-d)')}
  ${lab(90, 100, 'POWER', 'var(--sun-d)')}
  <div style="position:absolute;left:122mm;bottom:5mm;right:5mm;display:flex;gap:2mm;align-items:center" class="xs mute"><span style="width:5mm;height:5mm;border-radius:50%;background:var(--sun);display:inline-flex;align-items:center;justify-content:center;flex:none">${icon('plug', { size: 10, color: '#0A1530', stroke: 2.2 })}</span>Power from a UPS backup socket</div>
</div>
<div class="grid g3">
  ${card(feat('plug', 'sun', 'Power', 'Wall → UPS. PC, screen and printer → UPS backup sockets. Never a kettle, heater or fridge on the UPS.'))}
  ${card(feat('drawer', 'coral', 'The drawer', 'It opens each time a receipt prints (driver setting, page {{p:setup1}}). It never connects to the computer.'))}
  ${card(feat('wifi', 'teal', 'Internet', 'Only for backup and sync. Shop Wi-Fi, a LAN cable or a phone hotspot all work.'))}
</div>
`, 'diagram');

/* 6 — Setup part 1 */
const sb = (n, title, items, note = '') => `<div class="card"><div class="row" style="gap:6px;margin-bottom:1.6mm"><span class="chip ink">${n}</span><h3 style="margin:0">${title}</h3></div>${checklist(items)}${note ? `<p class="xs mute" style="margin-top:1.4mm">${note}</p>` : ''}</div>`;
P('04 · Setup steps', `
${sec('04', 'Step-by-step setup · part 1 of 3', 'Connect, then install the printer', 'Tick each box as you go and do the steps in order. A full till takes about 90 minutes.')}
<div class="grid g2">
  ${sb('A', 'Unbox, place and connect', [
    'Keep boxes and receipts for warranty.',
    'Screen on the counter. Mini PC behind it or beside it, with air around the vents.',
    'Screen → PC by DisplayPort (or VGA). Keyboard, mouse and scanner → PC USB.',
    'Printer USB → PC. Drawer RJ11 → printer port marked <b>DK</b>, not the LAN port.',
    'Wall → UPS. PC, screen and printer → UPS backup sockets. Switch on.',
  ], 'A new UPS should charge for a few hours before you rely on it in a blackout.')}
  ${sb('B', 'Check Windows and internet', [
    'Windows is activated and up to date. Set the date, time and time zone (Nairobi).',
    'Connect to Wi-Fi, a LAN cable or a phone hotspot. Open google.com to test.',
    'Create a Windows password for the owner. Cashiers only use their app PIN.',
  ])}
  ${sb('C', 'Install the Xprinter driver', [
    'Use the driver on the disc or USB stick in the box, or from the official Xprinter website. Never from unknown sites.',
    'Run the installer as administrator. Choose <b>XP-80</b> / <b>XP-Q80A</b> and the <b>USB</b> port it finds.',
    'Settings → Bluetooth &amp; devices → Printers &amp; scanners: the printer appears.',
    'Click it → <b>Print a test page</b>. It prints and cuts.',
    'Turn <b>off</b> “Let Windows manage my default printer”. Click the Xprinter → <b>Set as default</b>.',
  ], 'Remove any “Generic / Text Only” printer Windows added by itself. Pentarch POS prints to the default printer.')}
  ${sb('D', 'Paper and drawer', [
    'Load paper with the shiny side towards the print head (a fingernail scratch turns it dark).',
    'Printing preferences → paper size <b>80 × 297 mm</b> (may be “80mm Roll”). Minimum margins.',
    'Find the cash drawer option (often <b>Device Settings</b> or <b>Advanced</b>, e.g. “Cash Drawer #1”). Set it to open <b>before printing</b>.',
    'Print a test page: full width, not cut off, and the drawer pops open.',
  ], 'With this setting the drawer opens on every printed receipt. To open it without a sale, use the key, and record it in the app with <b>Open cash drawer (F10)</b> so it is logged.')}
</div>
<div class="card tint"><h3>${icon('checklist', { size: 15 })} Installer’s bag: bring these to every installation</h3>${checklist(['USB flash disk with the Xprinter drivers and Chrome installer', 'DisplayPort-to-VGA / HDMI adapter', 'USB Wi-Fi adapter and a LAN cable', 'Phone with hotspot data', 'Cable ties and a small screwdriver', 'Spare receipt roll (and label roll if sold)', 'This guide’s handover page, printed', 'The owner’s product list (Excel or photos)'], 'two')}</div>
`, 'setup1');

/* 7 — Setup part 2 */
P('04 · Setup steps', `
${sec('04', 'Step-by-step setup · part 2 of 3', 'Install the app and print receipts', 'Pentarch POS runs in Google Chrome and installs like a normal program.')}
<div class="grid g2">
  ${sb('E', 'Chrome and the app', [
    'Install or update <b>Google Chrome</b> (google.com/chrome).',
    `Open <span class="code">${CONTACT.app}</span>`,
    'Click <b>Install app</b> (the icon at the right of the address bar, or menu ⋮ → <b>Install Pentarch POS</b>).',
    'A Pentarch POS icon appears on the desktop and in Start. Pin it to the taskbar.',
  ])}
  ${sb('F', 'Sign in and run the setup wizard', [
    '<b>Sign in to my business</b> with the owner’s email and password (or <b>Start free trial</b> for a new business).',
    'Wizard: business details and logo, KRA PIN and VAT, branch, receipt (80 mm, footer, M-Pesa till), payment methods, staff and PINs, products.',
    'Products: import from Excel/CSV, pick from the starter list, or scan to add.',
  ])}
</div>
<div class="grid g-5-7" style="align-items:start">
  ${sb('G', 'Receipt test', [
    'Settings → Printing → <b>Print test page (80 mm)</b>.',
    'In Chrome’s print window choose the Xprinter, <b>Margins: None</b>, untick <b>Headers and footers</b>.',
    'Make a small cash sale and print the receipt. Check logo, KRA PIN, items, totals, M-Pesa till and footer. The drawer opens.',
    'Turn on <b>Print receipt automatically</b> in Settings → Printing.',
  ])}
  <div class="card dark">
    <div class="row" style="gap:6px;margin-bottom:1.6mm"><span class="chip" style="background:var(--sun);color:var(--ink)">H</span><h3 style="margin:0;color:#fff">Silent printing: no print window</h3></div>
    <p class="small" style="margin-bottom:2mm">Chrome prints straight to the default printer when it starts with the <span class="mono" style="color:#fff">--kiosk-printing</span> switch.</p>
    ${steps([
      { t: 'Close Chrome completely', d: 'Every window, including the Pentarch POS app.' },
      { t: 'Edit the shortcut', d: 'Right-click the Pentarch POS desktop icon → <b>Properties</b>.' },
      { t: 'Add the switch', d: 'In <b>Target</b>, at the end, type a space and <span class="mono" style="color:#fff">--kiosk-printing</span>. Click OK.' },
      { t: 'Test', d: 'Open the app from that icon and make a sale: the receipt prints with no window.' },
    ])}
  </div>
</div>
<div class="card tint">
  <h3>${icon('file', { size: 15 })} Example shortcut target</h3>
  <p class="mono" style="font-size:7.8pt;color:var(--text);word-break:break-all">"C:\\Program Files\\Google\\Chrome\\Application\\chrome_proxy.exe" --profile-directory=Default --app-id=<i>…</i> <b style="color:var(--coral-d);white-space:nowrap">--kiosk-printing</b></p><p class="xs mute" style="margin-top:1mm">Keep everything that is already there. Only add the part in red.</p>
</div>
${callout('warn', 'Labels and silent printing', 'With kiosk printing on, <b>everything</b> goes to the receipt printer. Print barcode labels from a normal Chrome window (open the same address in a Chrome tab), where you can choose the label printer. If Chrome was already open, the switch does nothing: close all Chrome windows first.')}
`, 'setup2');

/* 8 — Setup part 3 */
P('04 · Setup steps', `
${sec('04', 'Step-by-step setup · part 3 of 3', 'Scanner and label printer', 'The scanner needs no driver. The label printer needs its own driver and the right label size.')}
<div class="grid g2">
  ${sb('I', 'Scanner test', [
    'Plug in the scanner. It beeps. Windows sees it as a keyboard.',
    'Open Notepad and scan a product barcode. The numbers appear and the cursor jumps to a new line (the <b>Enter</b> suffix).',
    'In Pentarch POS open <b>Sell</b> and scan: the item goes into the cart.',
    'Scan a QR code on a phone screen to show it reads screens.',
  ], 'Wrong characters or no new line? Scan the setup barcodes in the scanner manual for “USB keyboard”, “US English” and “Add Enter (CR) suffix”. Check the Windows keyboard is English (US or UK).')}
  ${sb('J', 'Label printer (XP-470B)', [
    'Load the 40 × 30 mm roll, labels facing up, gap sensor over the gaps.',
    'Install the label printer driver from the disc or the official Xprinter website. Connect by USB.',
    'Printing preferences → <b>new paper size 40 × 30 mm</b>, gap about 2 mm. Make it the default size.',
    'Calibrate the gap sensor as the manual shows, so one label feeds per print.',
    'Print a test label.',
  ])}
</div>
<div class="grid g-7-5" style="align-items:start">
  ${shotC('duka-labels', [17.6, 12.5, 99, 92], [[20.8, 18.7, 1], [18.8, 35, 2], [18.8, 61, 3], [91.5, 16.2, 4]], 'Products → Print labels')}
  <div class="stack">
    <h2>Print labels from the app</h2>
    ${qs(1, 'Products → Print labels.', 'Products → Print labels.')}
    ${qs(2, 'Choose the label size, e.g. 40 × 30 mm, and what to show.', 'Chagua ukubwa wa label na unachotaka ionyeshe.')}
    ${qs(3, 'Scan or add items. Set how many labels of each.', 'Scan au ongeza bidhaa. Weka idadi ya labels.')}
    ${qs(4, 'Print. Choose the XP-470B in the print window.', 'Print. Chagua XP-470B kwenye dirisha la kuprint.')}
  </div>
</div>
${callout('tip', 'Other label sizes', 'The app also has 38 × 25 mm and 50 × 25 mm, and A4 sheets (3 × 8 and 4 × 10) for an ordinary office printer. Match the size in the app to the labels in the printer.')}
`, 'setup3');

/* 8b — Restaurants: kitchen tickets and kitchen screen (optional) */
P('04 · Setup steps', `
${sec('04', 'Restaurants and bars · optional', 'Kitchen tickets and kitchen screen', 'Only for clients with tables and a kitchen. Paper tickets need nothing extra. A kitchen screen is optional.')}
<div class="grid g2">
  ${card(`<h3><span class="ibox coral">${icon('printer', { size: 16 })}</span>A · Paper kitchen tickets</h3>${checklist([
    'Settings → Restaurant → <b>Print kitchen tickets</b> on. Set the copies.',
    'Settings → Restaurant → <b>Kitchen stations</b>, e.g. <span class="mono">kitchen, bar</span>. In each product, choose its station.',
    'Tap <b>Send to kitchen</b>: one ticket per station prints on the receipt printer of the device that sent it.',
    'Tear off each ticket and hand it to the kitchen or bar. A second round prints only the new items.',
  ])}<p class="xs mute" style="margin-top:1.4mm">There is no separate kitchen printer that receives tickets from the till. If the kitchen is far from the till, use a kitchen screen.</p>`)}
  ${card(`<h3><span class="ibox navy">${icon('monitor', { size: 16 })}</span>B · Kitchen screen (optional)</h3>${checklist([
    'Any device with Chrome in the kitchen: a 10-inch tablet on a wall mount, or a mini PC with a screen.',
    'Internet at the till <b>and</b> at the kitchen screen. New tickets arrive within a few seconds.',
    'The screen stays on and never locks itself on this page.',
    'Keep paper tickets on as a backup: if the till is offline, tickets wait and reach the screen when it reconnects.',
  ])}<p class="xs mute" style="margin-top:1.4mm">Devices for the kitchen and for waiters are not in the price list: Pentarch quotes them.</p>`)}
</div>
<div class="grid g-7-5" style="align-items:start">
  ${shotC('r-kds', [0, 6, 100, 96], [[1.6, 35.7, 1], [55.1, 18.9, 2], [89.7, 18.9, 3], [33.3, 55.3, 4]], 'Kitchen display')}
  <div class="stack">
    <h2>Set up the kitchen screen</h2>
    ${qs(1, 'Install the app, sign in to the business, then open Kitchen display.', 'Weka app, ingia kwenye biashara, fungua Kitchen display.')}
    ${qs(2, 'Choose the station: All, Kitchen or Bar.', 'Chagua kituo: All, Kitchen au Bar.')}
    ${qs(3, 'Full screen.', 'Bonyeza Full screen.')}
    ${qs(4, 'The cook taps Done; the waiter sees the table is ready.', 'Mpishi anabonyeza Done; mhudumu anaona meza iko tayari.')}
  </div>
</div>
<div class="grid g2">
  ${callout('info', 'Waiter phones and tablets', 'Chrome, the app installed and signed in once. Each waiter has a PIN and the Waiter role, and lands on Tables. A cashier or manager approves payment unless Settings → Restaurant allows waiters to take it.', 'phone')}
  ${callout('tip', 'Test before handover', 'Send a test order with one food and one drink: a kitchen and a bar ticket print, both appear on the kitchen screen, Done marks the table ready.')}
</div>
`, 'kitchen');

/* 9 — Barcodes */
P('05 · Barcodes', `
${sec('05', 'How barcodes work', 'Three kinds of items', 'Most packed goods already have a barcode. For the rest, the app makes one.')}
<div class="grid g3">
  ${card(`<span class="ibox teal">${icon('barcode', { size: 16 })}</span><h3 style="margin-top:2mm">1 · Already has a barcode</h3><p class="small">Sugar, flour, soap, drinks, medicines. Open the product, click in <b>Barcode</b> and scan the pack. Extra barcodes (e.g. a carton) can be added to the same product.</p>`)}
  ${card(`<span class="ibox coral">${icon('sparkle', { size: 16 })}</span><h3 style="margin-top:2mm">2 · No barcode</h3><p class="small">Clothes, cosmetics, hardware bits, loose items. Click <b>Generate EAN-13</b>: the app makes a unique in-shop code starting with <span class="mono">2</span>. Print labels and stick them on.</p>`)}
  ${card(`<span class="ibox sun">${icon('scale', { size: 16 })}</span><h3 style="margin-top:2mm">3 · Sold by weight</h3><p class="small">Meat, vegetables, sweets from a labelling scale. The scale prints a barcode starting with <span class="mono">21</span> (weight) or <span class="mono">22</span> (price). The app reads the item and the weight from it.</p>`)}
</div>
<div class="grid g-7-5" style="align-items:start">
  ${shotC('duka-product-form', [68, 17.5, 99.5, 58], [[74.3, 35.2, 1], [74.3, 41.5, 2], [74.3, 51, 3]], 'Product → Barcode panel')}
  <div class="stack">
    ${qs(1, 'Barcode field: scan the pack, or type the number.', 'Sehemu ya barcode: scan pakiti au andika namba.')}
    ${qs(2, 'Generate EAN-13 when the item has no barcode.', 'Generate EAN-13 kama bidhaa haina barcode.')}
    ${qs(3, 'Preview: this is what prints on the label.', 'Hivi ndivyo itakavyochapishwa kwenye label.')}
  </div>
</div>
<div class="grid g2">
  ${card(`<h3>${icon('tag', { size: 15 })} Sticking labels</h3><p class="small">Stick on a flat, clean part of the pack, not over a seam or curve. One label per item. Never cover the maker’s barcode — if an item has one, use it.</p>`)}
  ${card(`<h3>${icon('layers', { size: 15 })} Sizes and colours</h3><p class="small">For variants (shoe sizes, colours) each variant gets its own barcode and label, so stock is counted per size.</p>`)}
</div>
<h2>How a scale barcode reads</h2>
<div style="display:flex;gap:1.4mm;align-items:stretch">
  ${[['21', 'Prefix', 'weight item', 'var(--sun-d)'], ['00045', 'Item code', 'the product’s PLU', 'var(--navy)'], ['01250', 'Value', '1,250 g = 1.25 kg', 'var(--coral-d)'], ['7', 'Check', 'check digit', 'var(--teal-d)']].map(([v, t, d, c]) => `<div class="card" style="flex:${v.length + 1};text-align:center;border-top:4px solid ${c};padding:2.4mm"><div class="mono" style="font-size:15pt;font-weight:700;color:var(--text);letter-spacing:.12em">${v}</div><div class="small"><b>${t}</b></div><div class="xs mute">${d}</div></div>`).join('')}
</div>
<p class="small mute">Set the scale to the same format: prefix 21 for weight or 22 for price, then a 5-digit item code. The prefixes can be changed in Settings to match the scale.</p>
`, 'barcodes');

/* 10 — Offline, sync, backups */
P('06 · Offline & backups', `
${sec('06', 'Offline, sync and backups', 'Selling never stops', 'Every sale is saved on the computer first. The internet is only needed to back up and to share data with other devices.')}
${hsteps([
  { t: 'Sale saved', d: 'Written on this computer at once, internet or not.' },
  { t: 'Queued', d: 'Added to the “waiting” list. Nothing is dropped.' },
  { t: 'Online again', d: 'Wi-Fi or a phone hotspot, even for a few minutes.' },
  { t: 'Synced', d: 'Sent to the Pentarch cloud. Other devices and the owner’s phone update.' },
], 4)}
<div class="grid g2">
  ${card(`<h3>${icon('sync', { size: 15 })} The sync status at the top of the screen</h3>${table(['Shows', 'Means'], [
    [chip('Synced 2 min ago', 'teal'), 'Everything is backed up.'],
    [chip('Syncing', 'navy'), 'Sending now. Keep working.'],
    [chip('3 waiting', 'sun'), 'Saved here; will send when online.'],
    [chip('Offline', 'coral'), 'No internet. Selling still works.'],
  ], { cls: 'tight', widths: ['40%', '60%'] })}<p class="xs mute" style="margin-top:1.4mm">Sync runs when the app starts, every minute, after each sale and when the internet returns. Click the status to sync now.</p>`)}
  ${card(`<h3>${icon('download', { size: 15 })} Backups</h3>${ticks([
    '<b>Cloud backup</b> happens with every sync.',
    '<b>Download a backup</b>: Settings → Backup, restore &amp; export. Keep a copy on a flash disk or in Google Drive every week.',
    '<b>Export to Excel/CSV</b> at any time, even after the licence expires.',
    '<b>Restore</b> replaces all data on that computer. Only do it with Pentarch support.',
  ])}`)}
</div>
<div class="grid g2">
  ${callout('stop', 'Never clear Chrome’s site data', 'Clearing browsing data, cookies or “site data” for pentarchcommunications.com deletes the till’s local data. Anything not yet synced is lost. Check the status shows <b>Synced</b> before any Windows reset or clean-up.')}
  ${callout('info', 'Licence when offline', 'The app remembers the licence. A paid till keeps selling offline until the paid-up date plus 7 grace days. Connect at least once a week so the licence and backups stay current.')}
</div>
<h2>Moving to a new or repaired computer</h2>
${hsteps([{ t: 'Check sync', d: 'On the old computer (if it works): the status shows Synced.' }, { t: 'Install', d: 'New computer: Chrome, printer driver, open the app, Install app.' }, { t: 'Sign in', d: '<b>Sign in to my business</b> with the owner’s email and password.' }, { t: 'Data returns', d: 'Products, customers and sales download from the cloud.' }], 4)}
`, 'offline');

/* 11 — Windows hygiene */
P('07 · Keep it healthy', `
${sec('07', 'Windows hygiene', 'Keep the till healthy')}
<div class="grid g2">
  ${card(`<h3>${icon('power', { size: 16, color: 'var(--sun-d)' })} Power and sleep</h3>${checklist([
    'Settings → System → Power: <b>Sleep: Never</b>. Screen off after 15 minutes is fine.',
    'Power Options → advanced: <b>USB selective suspend: Disabled</b>, so the scanner and printer never drop off.',
    'BIOS (press F10 at start-up): <b>After Power Loss → Power On</b>, so the PC restarts by itself after a long blackout.',
  ])}`)}
  ${card(`<h3>${icon('refresh', { size: 16, color: 'var(--navy)' })} Updates</h3>${checklist([
    'Windows Update → <b>Active hours</b> = trading hours (e.g. 7am–10pm), so it never restarts during sales.',
    'Install updates after closing, once a week.',
    'Before any restart, check the status shows <b>Synced</b>.',
    'Let Chrome update itself; close it at night.',
  ])}`)}
  ${card(`<h3>${icon('shield', { size: 16, color: 'var(--teal-d)' })} Security</h3>${checklist([
    'Keep <b>Windows Security</b> (Defender) on. One antivirus only.',
    'The till is for selling only: no email, games, downloads, Chrome extensions or unknown flash disks.',
    'Owner keeps the Windows password. Turn on auto-lock in Pentarch POS (Settings → Staff).',
  ])}`)}
  ${card(`<h3>${icon('minipc', { size: 16, color: 'var(--coral-d)' })} The devices</h3>${checklist([
    'Keep the mini PC off the floor, out of the sun, with its vents clear.',
    'Use good thermal paper. Clean the print head with a spirit swab when receipts fade.',
    'Test the UPS once a month: unplug it from the wall for one minute.',
  ])}`)}
</div>
${callout('warn', 'Windows 10 on the Complete Till', 'Windows 10 no longer gets free security updates. Use the till for selling only, with Defender on. A client who wants Windows 11 can have the EliteDesk 800 G4 Mini (about KES 25,000 instead of 15,000) — ask Pentarch for the price.')}
<div class="grid g2">
  <div class="card"><h3>${icon('sun', { size: 15, color: 'var(--sun-d)' })} Opening the shop</h3>${checklist(['UPS on, then the PC and screen', 'Open Pentarch POS from its icon', 'Sign in with your PIN; open the shift with the float', 'Check the receipt printer has paper'])}</div>
  <div class="card"><h3>${icon('moon', { size: 15, color: 'var(--navy)' })} Closing the shop</h3>${checklist(['Close the shift; print the Z report', 'Status shows Synced (connect if not)', 'Close the app and Chrome; shut down Windows', 'Lock the drawer and take the key'])}</div>
</div>
<div class="card tint"><h3>${icon('calendar', { size: 15 })} Weekly 5-minute check (owner or manager)</h3>${checklist(['Status shows Synced', 'Backup downloaded this week', 'Windows updates installed after closing', 'Spare paper rolls in stock', 'Z reports for every shift; variances explained', 'Staff list current: remove anyone who has left'], 'two')}</div>
`, 'health');

/* 12 — Troubleshooting */
P('08 · Troubleshooting', `
${sec('08', 'Troubleshooting', 'When something does not work', 'Try the fixes in order. If it still fails, WhatsApp support with a photo of the screen and the business code.')}
${table(['Problem', 'Check this first', 'Then'], [
  ['<b>Screen says “No signal”</b>', 'Video cable firm at both ends. Screen input set to the right port (VGA / DP).', 'Try the other DisplayPort on the PC, or an adapter.'],
  ['<b>PC does not start after a blackout</b>', 'UPS switched on; PC adapter in a UPS backup socket.', 'Press the PC power button. Set BIOS After Power Loss → Power On.'],
  ['<b>No Wi-Fi option</b>', 'Many mini PCs have no Wi-Fi card.', 'Use a LAN cable to the router, or a USB Wi-Fi adapter.'],
  ['<b>Printer does not print</b>', 'Power on, paper in, lid closed, USB in. Windows test page prints?', 'Set the Xprinter as default. Remove “Generic / Text Only”. Reinstall the driver.'],
  ['<b>Drawer does not open</b>', 'RJ11 in the printer’s DK port (not LAN). Drawer unlocked?', 'Turn on the drawer option in the driver (page {{p:setup1}}). Test page should open it.'],
  ['<b>Scanner types wrong characters</b>', 'Windows keyboard language is English (US/UK).', 'Scan the “US English keyboard” barcode in the scanner manual.'],
  ['<b>Scan adds nothing</b>', 'Notepad test: does the cursor move to a new line?', 'Scan the “Add Enter (CR) suffix” barcode. Click the Sell screen first.'],
  ['<b>Receipt too wide or cut off</b>', 'Paper size 80 × 297 mm in printing preferences.', 'Chrome print: Margins None, scale 100%. Receipt width 80 mm in Settings → Printing.'],
  ['<b>A print window opens every time</b>', 'Print receipt automatically is on?', 'Add --kiosk-printing to the app shortcut (page {{p:setup2}}).'],
  ['<b>Status says Offline</b>', 'Is there internet? Open google.com.', 'Keep selling — it is safe. Connect when you can.'],
  ['<b>“N waiting” does not go down</b>', 'Internet working? Click the status to sync now.', 'Leave the app open online for 5 minutes. Then call support. Do not clear data.'],
  ['<b>Kitchen screen shows no new orders</b>', 'Internet at the till and in the kitchen? Till shows Synced?', 'Tap the status to sync now. Keep paper tickets on.'],
  ['<b>Trial ended or licence expired</b>', 'The banner shows the Paybill and the business code.', 'Pay by M-Pesa Paybill, account = business code. Reports and export still work.'],
  ['<b>Forgot owner password</b>', '—', 'Pentarch resets it and sends a new one on WhatsApp.'],
], { cls: 'tight', widths: ['25%', '37%', '38%'] })}
<div class="grid g-7-5">
  ${callout('tip', 'Before you call support', 'Have ready: the business code (PP…), what you were doing, a photo of the screen, and whether the status shows Synced, Offline or “N waiting”.')}
  <div class="card dark"><h3 style="color:#fff">${icon('call', { size: 16, color: 'var(--sun)' })} Pentarch support</h3><p class="small"><b>${CONTACT.phone}</b> · phone and WhatsApp<br>${CONTACT.email}<br>Monday–Saturday, 8am–6pm</p></div>
</div>
`, 'trouble');

/* 13 — Handover */
P('09 · Handover', `
${sec('09', 'Handover', 'Handover checklist', 'Complete with the owner present. Both sign. Keep a photo of this page in the client’s file.')}
<div class="grid g2">
  <div class="card"><h3>${icon('minipc', { size: 15 })} Devices</h3>${checklist(['PC, screen and printer on the UPS; UPS test done', 'Receipt prints and cuts; drawer opens', 'Scanner reads products and phone screens', 'Label printer prints 40 × 30 mm (if bought)', 'Internet works (Wi-Fi, LAN or hotspot)', 'Serial numbers and warranty papers given to the owner'])}</div>
  <div class="card"><h3>${icon('settings', { size: 15 })} Software</h3>${checklist(['App installed, pinned, silent printing on', 'Business details, KRA PIN, logo, receipt footer', 'M-Pesa till or paybill shows on receipts', 'Products loaded and prices checked by the owner', 'Staff created with PINs and the right roles', 'Status shows Synced; one backup downloaded', 'Sleep off, active hours and BIOS power setting done'])}</div>
</div>
<div class="card"><h3>${icon('users', { size: 15 })} Training</h3>${checklist(['Sales: cash, M-Pesa, split, and a return', 'Open and close a shift; print the Z report', 'Owner: Home, reports, add a product, print labels', 'Stock: receive a delivery, count stock', 'Restaurant (if used): table, send to kitchen, split bill', 'Owner knows how to pay; support <b>+254 729 455 912</b> saved in the owner’s phone'], 'two')}</div>
<h2>Devices installed</h2>
${table(['Device', 'Model', 'Serial number', 'Warranty until'], [['Mini PC', 'HP EliteDesk 800 G2 Mini', '', ''], ['Screen', 'HP 19-inch', '', ''], ['UPS', 'Mercury Elite 650 Pro', '', ''], ['Receipt printer', 'Xprinter XP-Q80A', '', ''], ['Cash drawer', 'OCOM ECD-420X', '', ''], ['Scanner', 'Syble XB-6221', '', '']], { cls: 'tight', widths: ['20%', '30%', '28%', '22%'] })}
<div class="card" style="border:1.5px dashed var(--navy)">
  <div class="grid g3" style="gap:6mm;margin-top:2mm">
    <div><div class="sig"></div><div class="xs mute">Business name and code (PP…)</div></div>
    <div><div class="sig"></div><div class="xs mute">Owner: name, signature, date</div></div>
    <div><div class="sig"></div><div class="xs mute">Installer: name, signature, date</div></div>
  </div>
</div>
`, 'handover');

/* 14 — Staff quick start (tear-out) */
const blk = (title, sw, img, crop, mk, lines) => `<div class="card" style="padding:2.6mm 3mm;display:flex;flex-direction:column;gap:1.6mm">
  <div><h2 style="margin:0;font-size:12pt">${title}</h2><div class="small" style="color:var(--teal-d);font-style:italic">${sw}</div></div>
  <div style="width:86%;margin:0 auto">${shotC(img, crop, mk)}</div>
  <div>${lines.map((l, i) => qs(i + 1, l[0], l[1], 'c')).join('')}</div></div>`;
P('Quick start · Shop staff', `
${sec('★', 'Keep at the till · practise each twice · Jizoeze kila moja mara mbili', 'Your first day at the till')}
<div class="grid g2" style="gap:4mm">
  ${blk('1 · Make a sale', 'Kuuza', 'duka-sell', [18, 13.5, 100, 100], [[19.6, 19.3, 1], [19.6, 34, 2], [71, 94, 3]], [
    ['Scan the barcode, or search by name.', 'Scan barcode, au tafuta kwa jina.'],
    ['Or tap the item. Tap again for one more.', 'Au gusa bidhaa. Gusa tena kuongeza moja.'],
    ['Pay (F4) → Cash → amount → Complete sale.', 'Pay (F4) → Cash → kiasi → Complete sale.'],
  ])}
  ${blk('2 · M-Pesa sale', 'Kuuza kwa M-Pesa', 'duka-tender-mpesa', [10.5, 9, 89.5, 91.5], [[12, 26.2, 1], [31, 60.5, 2], [31, 85, 3]], [
    ['Pay → M-Pesa. The customer pays to the till shown.', 'Pay → M-Pesa. Mteja analipa kwa till inayoonekana.'],
    ['Type the code from the customer’s M-Pesa SMS.', 'Andika code kutoka SMS ya M-Pesa ya mteja.'],
    ['Check the SMS, then Complete sale.', 'Hakikisha SMS, kisha bonyeza Complete sale.'],
  ])}
  ${blk('3 · Return or refund', 'Kurudisha bidhaa', 'duka-return', [21, 15.5, 79, 84.5], [[53.5, 28.7, 1], [64.7, 28.7, 2], [64.8, 80, 3]], [
    ['Sales &amp; receipts → the receipt → Return items. Set the quantity.', 'Sales &amp; receipts → risiti → Return items. Weka idadi.'],
    ['Back to stock: on if it can be sold again.', 'Back to stock: washa kama inaweza kuuzwa tena.'],
    ['Choose a reason and refund method. Confirm return.', 'Chagua sababu na njia ya kurudisha pesa. Confirm return.'],
  ])}
  ${blk('4 · Close the day', 'Kufunga siku', 'duka-close-shift', [21, 8, 79, 92.5], [[31.5, 23.2, 1], [50.5, 36.5, 2], [62, 87, 3]], [
    ['Cash &amp; shifts → Close shift. Count notes and coins.', 'Cash &amp; shifts → Close shift. Hesabu noti na sarafu.'],
    ['Check expected cash and the difference.', 'Angalia pesa inayotarajiwa na tofauti.'],
    ['Add a note if short. Close shift &amp; print Z.', 'Andika maelezo kama pesa imepungua. Close shift &amp; print Z.'],
  ])}
</div>
<div class="callout dark" style="padding:2mm 4mm;align-items:center">${icon('call', { size: 16 })}<div class="xs">Problem? Do not clear anything. WhatsApp Pentarch on <b>${CONTACT.phone}</b> with a photo of the screen. <span style="font-style:italic">Tatizo? Usifute kitu. Tuma picha ya skrini kwa WhatsApp.</span></div></div>
`, 'staff');

/* 15 — Restaurant staff quick start (tear-out) */
P('Quick start · Restaurant staff', `
${sec('★', 'Keep at the till · practise each twice · Jizoeze kila moja mara mbili', 'Restaurant: your first shift')}
<div class="grid g2" style="gap:4mm">
  ${blk('1 · Open a table', 'Kufungua meza', 'r-floor', [17.5, 9, 70, 67], mk('r-floor', [1]), [
    ['Tables: tap a free table.', 'Tables: gusa meza iliyo wazi.'],
    ['Enter the number of guests.', 'Weka idadi ya wageni.'],
    ['Dark tables are busy; “Ready” means food is done.', 'Meza nyeusi zina wateja; “Ready” chakula kiko tayari.'],
  ])}
  ${blk('2 · Send to kitchen', 'Kutuma jikoni', 'r-table-order', [17.5, 9, 80, 79], mk('r-table-order', [1, 2]), [
    ['Tap the food and drinks. Add a note if needed.', 'Gusa chakula na vinywaji. Ongeza maelezo ikihitajika.'],
    ['Send to kitchen: tickets print for the kitchen and the bar.', 'Send to kitchen: tiketi za jikoni na bar zinachapishwa.'],
    ['More later? Add items and send again.', 'Zaidi baadaye? Ongeza na utume tena.'],
  ])}
  ${blk('3 · Kitchen display', 'Skrini ya jikoni', 'r-kds', [17.5, 9, 100, 100], [[33.3, 55.3, 1], [55.1, 18.9, 2]], [
    ['Cook: when the food is ready, tap Done.', 'Mpishi: chakula kikiwa tayari, bonyeza Done.'],
    ['Show only your station: Kitchen or Bar.', 'Onyesha kituo chako tu: Kitchen au Bar.'],
    ['Done by mistake? Open Done and recall it.', 'Umekosea? Fungua Done uirudishe.'],
  ])}
  ${blk('4 · Split and pay', 'Kugawa bili na kulipa', 'r-split', [23, 12, 77, 78], mk('r-split', [1, 2]), [
    ['Split bill: tap + on what this person pays for.', 'Split bill: gusa + kwa anacholipia mtu huyu.'],
    ['Pay for these items. The rest stays on the table.', 'Pay for these items. Vingine vinabaki mezani.'],
    ['Or Equally: the bill shared by the number of people.', 'Au Equally: bili inagawanywa kwa idadi ya watu.'],
  ])}
</div>
<div class="callout dark" style="padding:2mm 4mm;align-items:center">${icon('call', { size: 16 })}<div class="xs">Removing an item already sent to the kitchen needs a manager PIN and a reason. <span style="font-style:italic">Kuondoa kitu kilichotumwa jikoni kunahitaji PIN ya meneja na sababu.</span></div></div>
`, 'staff-r');

export default { title: 'Pentarch POS — Hardware & Setup Guide', short: 'Pentarch POS · Hardware & Setup Guide', pages };
