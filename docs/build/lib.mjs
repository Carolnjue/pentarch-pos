// Shared template system for the Pentarch POS documents.
import fs from 'node:fs';
import { icon } from './icons.mjs';
export { icon };

const ROOT = new URL('./', import.meta.url).pathname;
export const IMG = (n) => `file://${ROOT}assets/img/${n}.jpg`;
const MARK = fs.readFileSync(ROOT + 'assets/pentarch-mark.svg', 'utf8').replace('<svg ', '<svg class="mark" ');
export const mark = (cls = '') => MARK.replace('class="mark"', `class="mark ${cls}"`);

export const CONTACT = { phone: '+254 729 455 912', email: 'info@pentarchcommunications.com', web: 'pentarchcommunications.com', app: 'pentarchcommunications.com/pos/', agents: 'pentarchcommunications.com/pos/agents/', demo: 'pentarchcommunications.com/pos/?demo=1', demoType: 'pentarchcommunications.com/pos/?demo=1&amp;type=', trial: 'pentarchcommunications.com/pos/?trial=1' };

const font = (fam, file, w, style = 'normal') => `@font-face{font-family:'${fam}';src:url('file://${ROOT}fonts/${file}') format('woff2');font-weight:${w};font-style:${style};font-display:block}`;
const FONTS = [
  font('Bricolage Grotesque', 'bricolage-grotesque-latin-500-normal.woff2', 500),
  font('Bricolage Grotesque', 'bricolage-grotesque-latin-600-normal.woff2', 600),
  font('Bricolage Grotesque', 'bricolage-grotesque-latin-700-normal.woff2', 700),
  font('Bricolage Grotesque', 'bricolage-grotesque-latin-800-normal.woff2', 800),
  font('DM Sans', 'dm-sans-latin-400-normal.woff2', 400),
  font('DM Sans', 'dm-sans-latin-400-italic.woff2', 400, 'italic'),
  font('DM Sans', 'dm-sans-latin-500-normal.woff2', 500),
  font('DM Sans', 'dm-sans-latin-700-normal.woff2', 700),
  font('JetBrains Mono', 'jetbrains-mono-latin-500-normal.woff2', 500),
  font('JetBrains Mono', 'jetbrains-mono-latin-700-normal.woff2', 700),
].join('\n');

export const CSS = `${FONTS}
:root{--ink:#0A1530;--ink2:#101E40;--ink3:#182A55;--navy:#1F3C7A;--coral:#EE4B3B;--coral-d:#C9301F;--sun:#F6B22C;--sun-d:#B97A00;--teal:#14B1AC;--teal-d:#0A7F7B;--paper:#F7F5F0;--paper2:#EFEBE3;--line:#E4E0D7;--text:#121A2E;--body:#3D475C;--mute:#646E82;
--grad:linear-gradient(100deg,#EE4B3B 0%,#F6B22C 48%,#14B1AC 100%);--coral-t:#FDECEA;--teal-t:#E3F5F4;--sun-t:#FEF5E1;--navy-t:#E8EDF6}
@page{size:A4;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:'DM Sans',sans-serif;font-size:10pt;line-height:1.5;color:var(--body);-webkit-print-color-adjust:exact;print-color-adjust:exact;font-feature-settings:'tnum' 0}
h1,h2,h3,h4,.h{font-family:'Bricolage Grotesque',sans-serif;color:var(--text);line-height:1.15;letter-spacing:-.01em}
b,strong{color:var(--text);font-weight:700}
.mono,.num{font-family:'JetBrains Mono',monospace;font-feature-settings:'tnum' 1}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;break-after:page;background:#fff;display:flex;flex-direction:column;padding:12mm 15mm 0 15mm}
.page:last-child{page-break-after:auto;break-after:auto}
.page.paper{background:var(--paper)}
.rh{display:flex;align-items:center;gap:8px;font-size:8pt;color:var(--mute);padding-bottom:3mm;border-bottom:1px solid var(--line);margin-bottom:6mm;flex:none}
.rh .mark{width:13px;height:13px}
.rh .wm{font-family:'Bricolage Grotesque';font-weight:800;color:var(--navy);letter-spacing:.14em;font-size:8.2pt}
.rh .doc{margin-left:2px}
.rh .sec{margin-left:auto;color:var(--text);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:7.3pt}
.content{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:3.8mm;overflow:hidden}
.content>*{flex:none}
.rf{flex:none;height:13mm;display:flex;align-items:center;gap:10px;font-size:7.6pt;color:var(--mute);border-top:1px solid var(--line);margin-top:3mm}
.rf .pn{margin-left:auto;font-family:'JetBrains Mono';font-weight:700;color:var(--ink);font-size:8.6pt;display:flex;align-items:center;gap:6px}
.rf .pn:before{content:'';display:inline-block;width:18px;height:3px;border-radius:2px;background:var(--grad)}
.rf .dot{width:3px;height:3px;border-radius:50%;background:var(--line)}
/* section heads */
.shead{display:flex;flex-direction:column;gap:1.6mm}
.kicker{font-size:7.8pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--coral-d);display:flex;align-items:center;gap:8px}
.kicker .n{font-family:'JetBrains Mono';background:var(--ink);color:#fff;border-radius:4px;padding:1px 5px;letter-spacing:0}
.shead h1{font-size:21pt;font-weight:800}
.shead .lead{font-size:11.2pt;color:var(--body);max-width:160mm;line-height:1.45}
h2{font-size:12.4pt;font-weight:700;margin-bottom:1.6mm}
h3{font-size:11pt;font-weight:700;margin-bottom:1mm}
p+p{margin-top:1.6mm}
.small{font-size:8.9pt}.xs{font-size:8pt}.mute{color:var(--mute)}
ul.dots{list-style:none;display:flex;flex-direction:column;gap:1.1mm}
ul.dots li{position:relative;padding-left:12px}
ul.dots li:before{content:'';position:absolute;left:1px;top:.62em;width:5px;height:5px;border-radius:50%;background:var(--coral)}
ul.ticks{list-style:none;display:flex;flex-direction:column;gap:1.1mm}
ul.ticks li{display:flex;gap:7px;align-items:flex-start}
ul.ticks li .ic{flex:none;margin-top:1px;color:var(--teal-d)}
ul.cross li .ic{color:var(--coral-d)}
/* layout */
.grid{display:grid;gap:3.4mm}
.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}.g5{grid-template-columns:repeat(5,1fr)}
.g-7-5{grid-template-columns:7fr 5fr}.g-5-7{grid-template-columns:5fr 7fr}.g-8-4{grid-template-columns:8fr 4fr}.g-4-8{grid-template-columns:4fr 8fr}
.row{display:flex;gap:3mm;align-items:center}
.grow{flex:1}
.stack{display:flex;flex-direction:column;gap:2.4mm}
.push{margin-top:auto}
/* cards */
.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:3.6mm 4mm}
.paper .card{background:#fff}
.card.tint{background:var(--paper)}
.card.dark{background:var(--ink);border-color:var(--ink);color:#C9D1E3}
.card.dark h3,.card.dark h2,.card.dark b{color:#fff}
.card h3{display:flex;align-items:center;gap:7px}
.ibox{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;flex:none}
.ibox.coral{background:var(--coral-t);color:var(--coral-d)}.ibox.teal{background:var(--teal-t);color:var(--teal-d)}.ibox.sun{background:var(--sun-t);color:var(--sun-d)}.ibox.navy{background:var(--navy-t);color:var(--navy)}.ibox.ink{background:var(--ink);color:#fff}
.feat{display:flex;gap:3mm;align-items:flex-start}
.feat h3{margin-bottom:.6mm}
.feat p{font-size:9.2pt}
/* callouts */
.callout{border-radius:10px;padding:3.2mm 4mm 3.2mm 4mm;display:flex;gap:3mm;align-items:flex-start;border:1px solid}
.callout .ic{flex:none;margin-top:1px}
.callout h4{font-size:10.4pt;font-weight:700;margin-bottom:.6mm;font-family:'Bricolage Grotesque'}
.callout.info{background:var(--navy-t);border-color:#CBD5EA}.callout.info .ic{color:var(--navy)}
.callout.tip{background:var(--teal-t);border-color:#BFE6E4}.callout.tip .ic{color:var(--teal-d)}
.callout.warn{background:var(--sun-t);border-color:#F3DCA6}.callout.warn .ic{color:var(--sun-d)}
.callout.stop{background:var(--coral-t);border-color:#F6C3BD}.callout.stop .ic{color:var(--coral-d)}
.callout.dark{background:var(--ink);border-color:var(--ink);color:#C9D1E3}.callout.dark h4,.callout.dark b{color:#fff}.callout.dark .ic{color:var(--sun)}
/* tables */
table{width:100%;border-collapse:separate;border-spacing:0;font-size:9.2pt}
th{font-family:'DM Sans';font-weight:700;text-align:left;color:#fff;background:var(--ink);padding:2mm 2.6mm;font-size:8.2pt;letter-spacing:.04em;text-transform:uppercase}
th:first-child{border-top-left-radius:8px}th:last-child{border-top-right-radius:8px}
td{padding:2mm 2.6mm;border-bottom:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:#FBFAF7}
td.r,th.r{text-align:right}td.c,th.c{text-align:center}
td .ic{vertical-align:-3px}
table.tight td{padding:1.4mm 2.4mm}
tr.total td{font-weight:700;color:var(--text);background:var(--paper2)!important;border-bottom:none}
.tbl{border:1px solid var(--line);border-radius:9px;overflow:hidden}
.tbl table th:first-child,.tbl table th:last-child{border-radius:0}
.tbl tr:last-child td{border-bottom:none}
/* chips */
.chip{display:inline-flex;align-items:center;gap:4px;font-size:7.8pt;font-weight:700;border-radius:999px;padding:.5mm 2.2mm;letter-spacing:.02em;white-space:nowrap}
.chip.coral{background:var(--coral-t);color:var(--coral-d)}.chip.teal{background:var(--teal-t);color:var(--teal-d)}.chip.sun{background:var(--sun-t);color:var(--sun-d)}.chip.navy{background:var(--navy-t);color:var(--navy)}.chip.ink{background:var(--ink);color:#fff}.chip.line{border:1px solid var(--line);color:var(--body)}
.kbd{font-family:'JetBrains Mono';font-size:8pt;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 4px;background:#fff;color:var(--text)}
.code{font-family:'JetBrains Mono';font-size:8.6pt;background:var(--paper2);border-radius:4px;padding:.2mm 1.4mm;color:var(--text)}
/* steps */
.steps{display:flex;flex-direction:column;gap:0}
.step{display:grid;grid-template-columns:9mm 1fr;gap:3mm;position:relative;padding-bottom:3mm}
.step:not(:last-child):before{content:'';position:absolute;left:4.5mm;top:9mm;bottom:0;width:2px;background:var(--line);transform:translateX(-1px)}
.step .sn{width:9mm;height:9mm;border-radius:50%;background:var(--ink);color:#fff;font-family:'JetBrains Mono';font-weight:700;font-size:9.7pt;display:flex;align-items:center;justify-content:center;z-index:1}
.step.c .sn{background:var(--coral-d)}.step.t .sn{background:var(--teal-d)}
.step h3{margin-top:1.6mm;margin-bottom:.5mm}
.step p{font-size:9.3pt}
.hsteps{display:grid;gap:2.4mm}
.hstep{background:#fff;border:1px solid var(--line);border-radius:10px;padding:3mm;position:relative}
.hstep .sn{font-family:'JetBrains Mono';font-weight:700;font-size:8.6pt;color:var(--coral-d);margin-bottom:1mm;display:block}
.hstep h3{font-size:10.2pt}
.hstep p{font-size:8.6pt}
.hstep:not(:last-child):after{content:'';position:absolute;right:-2.4mm;top:50%;width:2.4mm;height:2px;background:var(--line)}
/* checklist */
.cl{list-style:none;display:flex;flex-direction:column;gap:1.3mm}
.cl li{display:flex;gap:2.6mm;align-items:flex-start}
.cl li:before{content:'';flex:none;width:3.4mm;height:3.4mm;border:1.5px solid var(--navy);border-radius:3px;margin-top:.5mm;background:#fff}
.cl.two{display:grid;grid-template-columns:1fr 1fr;column-gap:6mm}
/* stats */
.stat{display:flex;flex-direction:column;gap:.4mm}
.stat .v{font-family:'Bricolage Grotesque';font-weight:800;font-size:19pt;color:var(--text);line-height:1}
.stat .l{font-size:8.4pt;color:var(--mute)}
.stat.sm .v{font-size:15pt;white-space:nowrap}
.gradtext{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.gradbar{height:3px;border-radius:2px;background:var(--grad)}
/* device frames */
.monitor{position:relative;margin:0 auto;display:flex;flex-direction:column;align-items:center}
.monitor .scr{width:100%;background:#0b0f19;border-radius:8px;padding:1.8% 1.8% 2.4%;box-shadow:0 0 0 1px #2a3247 inset,0 6px 16px rgba(10,21,48,.16)}
.monitor .scr img{display:block;width:100%;border-radius:2px}
.monitor .neck{width:11%;height:14px;background:linear-gradient(90deg,#aeb3be,#d7dae1,#aeb3be)}
.monitor .foot{width:34%;height:5px;border-radius:5px 5px 2px 2px;background:linear-gradient(#d9dce3,#a9aebb)}
.laptop{position:relative;margin:0 auto}
.laptop .scr{background:#0b0f19;border-radius:9px 9px 0 0;padding:2.2% 2.2% 2.6%;box-shadow:0 0 0 1px #2a3247 inset}
.laptop .scr img{display:block;width:100%;border-radius:2px}
.laptop .base{height:9px;background:linear-gradient(#d9dce3,#b8bcc6);border-radius:0 0 12px 12px;margin:0 -4%;position:relative}
.laptop .base:after{content:'';position:absolute;left:42%;right:42%;top:0;height:3px;background:#a2a7b2;border-radius:0 0 4px 4px}
.phone{position:relative;background:#0b0f19;border-radius:22px;padding:7px;box-shadow:0 6px 18px rgba(10,21,48,.18)}
.phone img{display:block;width:100%;border-radius:16px}
.phone .notch{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:28%;height:9px;background:#0b0f19;border-radius:0 0 8px 8px;z-index:2}
.shot{border-radius:8px;border:1px solid var(--line);display:block;width:100%}
figure{display:flex;flex-direction:column;gap:1.6mm}
figcaption{font-size:8.2pt;color:var(--mute);text-align:center}
/* quote / pitch */
.pitch{border-radius:12px;padding:4.4mm 5mm;position:relative}
.pitch p{font-size:10pt;line-height:1.55;color:var(--text)}
.pitch .lang{font-size:7.6pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:1.6mm;display:flex;gap:6px;align-items:center}
/* objection */
.obj{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;display:flex;flex-direction:column}
.obj .q{background:var(--ink);color:#fff;padding:2.4mm 3.6mm;font-family:'Bricolage Grotesque';font-weight:700;font-size:10.4pt;display:flex;gap:8px;align-items:center}
.obj .q .n{font-family:'JetBrains Mono';font-size:8pt;color:var(--sun);font-weight:700}
.obj .a{padding:3mm 3.8mm;font-size:9.6pt;line-height:1.5}
.obj .a p{color:var(--text)}
.obj .do{padding:1.8mm 3.6mm;background:var(--teal-t);font-size:8.5pt;color:var(--teal-d);display:flex;gap:6px;align-items:flex-start;margin-top:auto}
.obj .do b{color:var(--teal-d)}
/* price */
.price{font-family:'Bricolage Grotesque';font-weight:800;color:var(--text);line-height:1}
.price small{font-family:'DM Sans';font-weight:500;font-size:.42em;color:var(--mute);margin-left:2px}
.pk{border-radius:12px;border:1px solid var(--line);background:#fff;overflow:hidden;display:flex;flex-direction:column}
.pk .top{padding:4mm 4.4mm 3mm}
.pk .name{font-family:'Bricolage Grotesque';font-weight:800;font-size:12.5pt;color:var(--text)}
.pk .for{font-size:8.6pt;color:var(--mute)}
.pk .body{padding:0 4.4mm 4mm;font-size:9.2pt}
.pk.hero{border:2px solid var(--coral)}
.pk .flag{background:var(--coral-d);color:#fff;font-size:7.6pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:1mm 4.4mm}
/* cover */
.cover{background:var(--ink);color:#C9D1E3;padding:0}
.cover .cv{position:absolute;inset:0;display:flex;flex-direction:column;padding:18mm 17mm 14mm}
.cover .glow{position:absolute;width:150mm;height:150mm;right:-50mm;top:-40mm;border-radius:50%;background:radial-gradient(circle,rgba(246,178,44,.26),rgba(238,75,59,.08) 45%,transparent 70%)}
.cover .glow2{position:absolute;width:120mm;height:120mm;left:-50mm;bottom:20mm;border-radius:50%;background:radial-gradient(circle,rgba(20,177,172,.20),transparent 65%)}
.cover .brand{display:flex;align-items:center;gap:10px;z-index:1}
.cover .brand .mark{width:34px;height:34px}
.cover .brand .wm{font-family:'Bricolage Grotesque';font-weight:800;letter-spacing:.2em;color:#fff;font-size:12pt}
.cover .brand .sub{font-size:8.2pt;color:#93A0BE;letter-spacing:.06em}
.cover h1{font-size:40pt;font-weight:800;color:#fff;line-height:1.02;letter-spacing:-.02em}
.cover .tag{font-size:12.5pt;color:#C9D1E3;max-width:140mm;line-height:1.4}
.cover .meta{display:flex;gap:6mm;font-size:8.6pt;color:#93A0BE;z-index:1}
.cover .meta b{color:#fff;display:block;font-size:9.7pt}
.cover .stripe{height:4px;background:var(--grad);position:absolute;left:0;right:0;bottom:0}
/* misc */
.divider{height:1px;background:var(--line)}
.center{text-align:center}
.nowrap{white-space:nowrap}
.flow{display:flex;flex-direction:column;align-items:stretch;gap:0}
.q-node{background:var(--ink);color:#fff;border-radius:10px;padding:2.6mm 3.6mm;font-family:'Bricolage Grotesque';font-weight:700;font-size:10.4pt;text-align:center}
.a-node{border-radius:10px;padding:2.6mm 3.4mm;font-size:9.1pt;border:1px solid var(--line);background:#fff}
.a-node .pkname{font-family:'Bricolage Grotesque';font-weight:800;font-size:10pt;color:var(--text);display:block}
.conn{display:flex;justify-content:center;align-items:center;height:6mm;color:var(--mute);font-size:8pt;font-weight:700;gap:4px}
.conn:before{content:'';width:2px;height:100%;background:var(--line);position:absolute}
.yes{color:var(--teal-d)}.no{color:var(--coral-d)}
.funnel{display:flex;flex-direction:column;gap:1.6mm;align-items:center}
.fbar{height:11mm;border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:0 4mm;color:#fff;font-weight:700}
.fbar .fv{font-family:'Bricolage Grotesque';font-size:15pt;font-weight:800}
.tl{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;position:relative}
.tl:before{content:'';position:absolute;left:4%;right:4%;top:6.5mm;height:3px;background:var(--grad);border-radius:2px}
.tl .d{display:flex;flex-direction:column;align-items:center;text-align:center;gap:1.2mm;padding:0 1mm;position:relative}
.tl .d .dot{width:13mm;height:13mm;border-radius:50%;background:#fff;border:2.5px solid var(--ink);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono';font-weight:700;font-size:9.3pt;color:var(--ink);z-index:1}
.tl .d.hot .dot{background:var(--coral-d);border-color:var(--coral-d);color:#fff}
.tl .d.win .dot{background:var(--teal-d);border-color:var(--teal-d);color:#fff}
.tl .d h3{font-size:9.5pt;margin:0}
.tl .d p{font-size:8.6pt;line-height:1.38}
.msg{background:#E7F7EE;border:1px solid #CBE9D7;border-radius:10px 10px 10px 2px;padding:2.4mm 3mm;font-size:8.9pt;color:#1C2B22}
.toc{display:grid;grid-template-columns:1fr 1fr;gap:1.6mm 8mm}
.toc a{display:flex;align-items:baseline;gap:3mm;color:var(--text);text-decoration:none;padding:1.6mm 0;border-bottom:1px dashed var(--line);font-size:10.2pt}
.toc a .tn{font-family:'JetBrains Mono';font-weight:700;color:var(--coral-d);font-size:8.6pt;width:6mm}
.toc a .tp{margin-left:auto;font-family:'JetBrains Mono';color:var(--mute);font-size:8.6pt}
.tbl table.fit{font-size:8.5pt}
.tbl table.fit td{padding:1.25mm 2.2mm}
.mk{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;background:var(--coral);color:#fff;font:700 9.5pt 'JetBrains Mono';display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2.5px #fff,0 2px 6px rgba(10,21,48,.35);z-index:3}
.mk.t{background:var(--teal-d)}.mk.n{background:var(--ink)}
.qs{display:grid;grid-template-columns:7mm 1fr;gap:2.4mm;align-items:start;padding:1.6mm 0;border-bottom:1px solid var(--line)}
.qs:last-child{border-bottom:none}
.qs .qn{width:7mm;height:7mm;border-radius:50%;background:var(--coral);color:#fff;font:700 9pt 'JetBrains Mono';display:flex;align-items:center;justify-content:center}
.qs .en{font-weight:700;color:var(--text);font-size:10pt;line-height:1.3}
.qs .sw{font-size:8.8pt;color:var(--teal-d);font-style:italic;line-height:1.3}
.qs.c{grid-template-columns:5.6mm 1fr;gap:2mm;padding:1.1mm 0}.qs.c .qn{width:5.6mm;height:5.6mm;font-size:8pt}.qs.c .en{font-size:9pt}.qs.c .sw{font-size:8.2pt}
.card.dark .step h3{color:#fff}.card.dark .step p{color:#C9D1E3}.card.dark .step .sn{background:var(--coral-d)}.card.dark .step:not(:last-child):before{background:#2a3a66}
.sig{border-bottom:1px solid var(--text);height:9mm}
`;

// ---------- components ----------
export const sec = (num, kicker, title, lead = '') => `<div class="shead"><div class="kicker">${num ? `<span class="n">${num}</span>` : ''}${kicker}</div><h1>${title}</h1>${lead ? `<div class="lead">${lead}</div>` : ''}</div>`;
export const callout = (type, title, html, ic) => {
  const def = { info: 'info', tip: 'thumb', warn: 'alert', stop: 'ban', dark: 'star' };
  return `<div class="callout ${type}">${icon(ic || def[type], { size: 18 })}<div>${title ? `<h4>${title}</h4>` : ''}<div class="small">${html}</div></div></div>`;
};
export const table = (head, rows, { cls = '', align = [], widths = [] } = {}) => `<div class="tbl"><table class="${cls}">${widths.length ? `<colgroup>${widths.map((w) => `<col style="width:${w}">`).join('')}</colgroup>` : ''}<thead><tr>${head.map((h, i) => `<th class="${align[i] || ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr class="${r.cls || ''}">${(r.cells || r).map((c, i) => `<td class="${align[i] || ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const feat = (ic, color, title, text) => `<div class="feat"><span class="ibox ${color}">${icon(ic, { size: 16 })}</span><div><h3>${title}</h3><p>${text}</p></div></div>`;
export const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;
export const steps = (items, cls = '') => `<div class="steps ${cls}">${items.map((s, i) => `<div class="step ${s.c || ''}"><div class="sn">${s.n ?? i + 1}</div><div><h3>${s.t}</h3>${s.d ? `<p>${s.d}</p>` : ''}</div></div>`).join('')}</div>`;
export const hsteps = (items, cols) => `<div class="hsteps" style="grid-template-columns:repeat(${cols || items.length},1fr)">${items.map((s, i) => `<div class="hstep"><span class="sn">${s.n ?? String(i + 1).padStart(2, '0')}</span><h3>${s.t}</h3>${s.d ? `<p>${s.d}</p>` : ''}</div>`).join('')}</div>`;
export const checklist = (items, cls = '') => `<ul class="cl ${cls}">${items.map((i) => `<li><span>${i}</span></li>`).join('')}</ul>`;
export const ticks = (items, cls = '') => `<ul class="ticks ${cls}">${items.map((i) => `<li>${icon(cls.includes('cross') ? 'x' : 'check', { size: 14, stroke: 2.4 })}<span>${i}</span></li>`).join('')}</ul>`;
export const dots = (items) => `<ul class="dots">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
export const chip = (t, c = 'navy') => `<span class="chip ${c}">${t}</span>`;
export const stat = (v, l, cls = '') => `<div class="stat ${cls}"><span class="v">${v}</span><span class="l">${l}</span></div>`;
const monitorHTML = (img, overlay = '') => `<div class="monitor"><div class="scr"><div style="position:relative"><img src="${IMG(img)}">${overlay}</div></div><div class="neck"></div><div class="foot"></div></div>`;
export const monitor = (img, cap = '', width = '94%') => `<figure style="width:${width};margin:0 auto">${monitorHTML(img)}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
export const monitorA = (img, list, cap = '', width = '94%') => `<figure style="width:${width};margin:0 auto">${monitorHTML(img, marks(list))}${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
export const laptop = (img, cap = '', width = '94%') => `<figure style="width:${width};margin:0 auto"><div class="laptop"><div class="scr"><img src="${IMG(img)}"></div><div class="base"></div></div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
export const phone = (img, cap = '', width = '100%', overlay = '') => `<figure style="width:${width};margin:0 auto"><div class="phone"><div style="position:relative"><img src="${IMG(img)}">${overlay}</div></div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
export const shot = (img, cap = '') => `<figure><img class="shot" src="${IMG(img)}">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
export const kes = (n) => 'KES ' + Number(n).toLocaleString('en-US');

// JPEG/PNG size reader (for cropped screenshots)
export function imgSize(name) {
  const b = fs.readFileSync(`${ROOT}assets/img/${name}.jpg`);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no size ' + name);
}
// cropped screenshot with markers given in % of the FULL image; crop = [x0, y0, x1, y1] in %
export function shotC(img, crop, list = [], cap = '', frame = 'shot') {
  const { w, h } = imgSize(img);
  const [x0, y0, x1, y1] = crop; const cw = x1 - x0, ch = y1 - y0;
  const ratio = (w * cw) / (h * ch);
  const mk = list.map(([x, y, n, c]) => [((x - x0) / cw) * 100, ((y - y0) / ch) * 100, n, c]);
  return `<figure><div class="${frame}" style="position:relative;overflow:hidden;aspect-ratio:${ratio.toFixed(4)};padding:0"><img src="${IMG(img)}" style="position:absolute;max-width:none;width:${(10000 / cw).toFixed(3)}%;left:${(-x0 * 100 / cw).toFixed(3)}%;top:${(-y0 * 100 / ch).toFixed(3)}%">${marks(mk)}</div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
}
// recorded marker positions from capture4.mjs (assets/shots/marks.json): mk('q-editor', [1, null, 2]) → markers for shotC
const MARKS = (() => { try { return JSON.parse(fs.readFileSync(ROOT + 'assets/shots/marks.json', 'utf8')); } catch { return {}; } })();
export const mk = (name, nums, cls = '') => (MARKS[name] || []).map((p, i) => (p && nums[i] != null ? [p[0], p[1], nums[i], cls] : null)).filter(Boolean);
export const marks = (list) => list.map(([x, y, n, c = '']) => `<span class="mk ${c}" style="left:${x}%;top:${y}%">${n}</span>`).join('');
export const phoneA = (img, list, cap = '', width = '100%') => phone(img, cap, width, marks(list));
export const laptopA = (img, list, cap = '', width = '94%') => `<figure style="width:${width};margin:0 auto"><div class="laptop"><div class="scr"><div style="position:relative"><img src="${IMG(img)}">${marks(list)}</div></div><div class="base"></div></div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
export const shotA = (img, list, cap = '') => `<figure><div style="position:relative"><img class="shot" src="${IMG(img)}">${marks(list)}</div>${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>`;
// quick-start line: number, English, Kiswahili
export const qs = (n, en, sw, cls = '') => `<div class="qs ${cls}"><span class="qn">${n}</span><div><div class="en">${en}</div>${sw ? `<div class="sw">${sw}</div>` : ''}</div></div>`;

// ---------- document renderer ----------
// pages: [{ sec: 'Section label', cls: '', html, bare: bool }]
export function renderDoc({ title, short, pages }) {
  const total = pages.length;
  // page references: {{p:key}} → page number of the page with that key
  const keyNo = {}; pages.forEach((p, i) => { if (p.key) keyNo[p.key] = i + 1; });
  pages.forEach((p) => { p.html = p.html.replace(/\{\{(pp?):([\w-]+)\}\}/g, (m, t, k) => { if (!keyNo[k]) throw new Error('unknown page key ' + k); return t === 'pp' ? String(keyNo[k]).padStart(2, '0') : String(keyNo[k]); }); });
  const body = pages.map((p, i) => {
    if (p.bare) return `<section class="page ${p.cls || ''}" data-p="${i + 1}">${p.html}</section>`;
    return `<section class="page ${p.cls || ''}" data-p="${i + 1}">
<header class="rh">${mark()}<span class="wm">PENTARCH</span><span class="doc">${short}</span><span class="sec">${p.sec || ''}</span></header>
<div class="content">${p.html}</div>
<footer class="rf"><span>${CONTACT.web}</span><span class="dot"></span><span>${CONTACT.phone} (phone &amp; WhatsApp)</span><span class="dot"></span><span>${CONTACT.email}</span><span class="pn">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span></footer>
</section>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

export function cover({ title, kicker, tag, meta = [], art = '' }) {
  return `<div class="glow"></div><div class="glow2"></div><div class="cv">
  <div class="brand">${mark()}<div><div class="wm">PENTARCH</div><div class="sub">COMMUNICATIONS · NAIROBI</div></div></div>
  <div style="margin-top:22mm;z-index:1;display:flex;flex-direction:column;gap:5mm">
    <div class="kicker" style="color:var(--sun)">${kicker}</div>
    <h1>${title}</h1>
    <div class="tag">${tag}</div>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;z-index:1;padding:8mm 0">${art}</div>
  <div class="meta">${meta.map(([k, v]) => `<div>${k}<b>${v}</b></div>`).join('')}</div>
</div><div class="stripe"></div>`;
}
