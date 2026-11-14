import{aj as v,bM as n,a9 as x,bN as u}from"./index-CyU-2bPn.js";const d={"38x25":{name:"38 × 25 mm",w:38,h:25,sheet:!1},"40x30":{name:"40 × 30 mm",w:40,h:30,sheet:!1},"50x25":{name:"50 × 25 mm",w:50,h:25,sheet:!1},"a4-3x8":{name:"A4 sheet 3 × 8 (70 × 37 mm)",w:70,h:37.1,cols:3,rows:8,sheet:!0},"a4-4x10":{name:"A4 sheet 4 × 10 (52.5 × 29.7 mm)",w:52.5,h:29.7,cols:4,rows:10,sheet:!0}};async function z(f,w,t,{businessName:l="",expiry:h=""}={}){const e=d[w]||d["38x25"],i=e.h<30,m=new Map,o=[];for(const{product:s,qty:g,expiry:r}of f){const a=s.barcode||s.sku||"";let c="";t.barcode&&a&&(m.has(a)||m.set(a,await v(a,{height:i?22:30,width:e.w<45?1.15:1.4,fontSize:i?9:10})),c=m.get(a));const b=`<div class="lab">
      ${t.business&&l?`<div class="biz">${n(l)}</div>`:""}
      ${t.name?`<div class="nm">${n(s.name)}</div>`:""}
      ${c?`<div class="bc">${c}</div>`:""}
      <div class="ft">${t.sku&&s.sku?`<span>${n(s.sku)}</span>`:"<span></span>"}${t.price?`<b>KES ${x(s.price)}</b>`:""}</div>
      ${t.expiry&&(r||h)?`<div class="ex">EXP ${n(r||h)}</div>`:""}
    </div>`;for(let p=0;p<g;p++)o.push(b)}const $=`
  @page { size: ${e.sheet?"A4":`${e.w}mm ${e.h}mm`}; margin: ${e.sheet?"10.7mm 0 0 0":"0"}; }
  body { width: ${e.sheet?"210mm":e.w+"mm"}; font-family: 'DM Sans', Arial, sans-serif; }
  .sheet { display: grid; grid-template-columns: repeat(${e.cols||1}, ${e.w}mm); ${e.sheet?"justify-content: center;":""} }
  .lab { width: ${e.w}mm; height: ${e.h}mm; padding: 1.2mm 1.8mm; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; ${e.sheet?"":"page-break-after: always;"} }
  .biz { font-size: 6.5pt; text-transform: uppercase; letter-spacing: .05em; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nm { font-size: ${i?7.5:9}pt; font-weight: 700; line-height: 1.1; max-height: 2.2em; overflow: hidden; }
  .bc { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; } .bc svg { max-width: 100%; max-height: 100%; }
  .ft { display: flex; justify-content: space-between; align-items: baseline; font-size: 6.5pt; } .ft b { font: 800 ${i?9:11}pt 'JetBrains Mono', monospace; }
  .ex { font-size: 6.5pt; font-weight: 700; }`;return{html:u(`<div class="sheet">${o.join("")}</div>`,{paper:"a4",title:"Labels",css:$}).replace(/@page \{ size: A4; margin: 12mm; \}/,""),count:o.length,preset:e}}export{d as L,z as l};
