// Demo data for salons: appointments today and tomorrow, own commission rates on two premium services.
import { db } from '../../db/index.js';
import { ulid } from '../../lib/ulid.js';

export async function demoSeed({ type, branch, users, products, customers, now, stamp }) {
  if (type !== 'salon') return;
  const d = db();
  const stylists = users.filter((u) => u.commission_pct > 0);
  const svc = products.filter((p) => p.type === 'service');
  if (!stylists.length || !svc.length) return;
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const at = (dayOffset, h, m) => day.getTime() + dayOffset * 86400000 + (h * 60 + m) * 60000;
  const by = (re) => svc.find((p) => re.test(p.name)) || svc[0];
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();
  const plan = [
    [0, 8, 30, /Wash & blow/, 0, 0], [0, 9, 0, /Box braids/, 1, 1], [0, 10, 30, /Haircut \(men\)/, 2, 2], [0, 11, 0, /Manicure/, 0, 3],
    [0, 13, 30, /Relaxer/, 1, 4], [0, 15, 0, /Pedicure/, 2, 5], [0, 16, 30, /Knotless/, 0, 6], [0, 18, 0, /Facial/, 1, 7],
    [1, 9, 0, /Weave/, 0, 8], [1, 10, 0, /Haircut & shave/, 2, 9], [1, 14, 0, /Eyelash/, 1, 2], [2, 11, 0, /Event makeup/, 0, 4]
  ];
  const appts = plan.map(([dd, h, m, re, si, ci]) => {
    const p = by(re);
    const c = customers[ci % customers.length];
    const start = at(dd, h, m);
    const past = dd === 0 && h * 60 + m + (p.service_duration_min || 30) < nowMin;
    const current = dd === 0 && !past && h * 60 + m <= nowMin;
    return stamp({ id: ulid(start - 86400000), customer_id: c.id, customer_name: c.name, phone: c.phone, product_id: p.id, service_name: p.name, duration_min: p.service_duration_min || 30,
      staff_id: stylists[si % stylists.length].id, start, status: past ? (ci === 3 ? 'no_show' : 'done') : current ? 'arrived' : 'booked', note: ci === 1 ? 'Colour 1B, client brings own hair' : '', branch_id: branch.id, created_at: start - 86400000 });
  });
  await d.appointments.bulkPut(appts);
  const premium = products.filter((p) => /Box braids|Knotless/.test(p.name));
  if (premium.length) await d.products.bulkPut(premium.map((p) => ({ ...p, commission_pct: 40 })));
}
