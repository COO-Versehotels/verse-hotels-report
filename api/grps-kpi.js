// ============================================================
// Vercel Serverless Function — sinkron data GRPS untuk Live Score KPI
// Dipanggil pg_cron (Supabase) tiap ±30 menit: POST {auth}
// 1) ambil Apps Script GRPS mode=kpi (bulan ini; tgl 1–5 juga bulan lalu)
// 2) simpan ke Supabase lewat RPC grps_kpi_simpan (auth dicek di DB)
// ============================================================
export const config = { maxDuration: 60 };

const GRPS_API_URL = 'https://script.google.com/macros/s/AKfycbz3b0dZeU2TMYT2x9V9SjhE8rlK5aDDhJ1hM2OnBrX1KawBpFkBCSu7kqF5pbT2eGWSyQ/exec';
const GRPS_API_KEY = 'verse-grps-rating-2026';
const REC_KEY = 'sb_publishable_d2HGQ_kntjoQC9G4XtIFWA_XT0_IDw1'; // kunci publik app Recruitment (sudah ada di index.html-nya)

function ymJakarta(offsetBulan) {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetBulan, 1));
  return { ym: d.toISOString().slice(0, 7), hari: now.getUTCDate() };
}

async function ambil(ym) {
  const url = GRPS_API_URL + '?key=' + encodeURIComponent(GRPS_API_KEY) + '&mode=kpi&bulan=' + ym;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
    const j = JSON.parse(await r.text());
    if (!j || !j.success) throw new Error((j && j.error) || 'GRPS gagal');
    return j;
  } finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const auth = String((body && body.auth) || '');
  if (!auth) { res.status(401).json({ ok: false, error: 'NOT_AUTHORIZED' }); return; }

  const SUPA_URL = process.env.SUPABASE_URL || 'https://hgbqecsmhrzlavsjwlwq.supabase.co';
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_KeAmOu9ex8r1PDRI1MRMsQ_40uiEkbM';

  const ini = ymJakarta(0);
  const daftar = [ini.ym];
  if (ini.hari <= 5) daftar.unshift(ymJakarta(-1).ym);

  const hasil = [];
  for (const ym of daftar) {
    try {
      const data = await ambil(ym);
      const r = await fetch(SUPA_URL + '/rest/v1/rpc/grps_kpi_simpan', {
        method: 'POST',
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_auth: auth, p_data: { units: data.units } })
      });
      const t = await r.text();
      if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + t.slice(0, 200));
      hasil.push({ bulan: ym, baris: Number(t) || 0 });
    } catch (e) {
      hasil.push({ bulan: ym, error: String(e && e.message || e) });
    }
  }
  // Rating per unit (GRPS) + data manning (Recruitment) untuk skor HM & Corporate
  const simpanSumber = async (nama, data) => {
    const r = await fetch(SUPA_URL + '/rest/v1/rpc/kpi_sumber_simpan', {
      method: 'POST',
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_auth: auth, p_nama: nama, p_data: data })
    });
    if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  };
  const HM = { LITE: 'HM Verse Lite', LUXE: 'HM Verse Luxe', CIREBON: 'HM Verse Cirebon', OAK: 'HM Oak Tree' };
  await Promise.all(Object.keys(HM).map(async u => {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 40000);
      const r = await fetch(GRPS_API_URL + '?key=' + encodeURIComponent(GRPS_API_KEY) + '&role=' + encodeURIComponent(HM[u]), { redirect: 'follow', signal: ctrl.signal });
      clearTimeout(t);
      const j = JSON.parse(await r.text());
      if (!j || !j.success) throw new Error((j && j.error) || 'rating gagal');
      await simpanSumber('rating_' + u, j);
      hasil.push({ rating: u, ok: true });
    } catch (e) { hasil.push({ rating: u, error: String(e && e.message || e) }); }
  }));
  // Revenue & ARR (Daily Occupancy Report) untuk skor HM
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 40000);
    const r = await fetch(GRPS_API_URL + '?key=' + encodeURIComponent(GRPS_API_KEY) + '&mode=occ', { redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    const j = JSON.parse(await r.text());
    if (!j || !j.success || !j.units) throw new Error((j && j.error) || 'occ belum tersedia');
    await simpanSumber('occ', j);
    hasil.push({ occ: true });
  } catch (e) { hasil.push({ occ: false, info: String(e && e.message || e) }); }
  try {
    const r = await fetch('https://bfqxsbyqaewdjstkrmsb.supabase.co/rest/v1/rpc/manning_kpi', {
      method: 'POST', headers: { apikey: REC_KEY, Authorization: 'Bearer ' + REC_KEY, 'Content-Type': 'application/json' }, body: '{}'
    });
    if (!r.ok) throw new Error('Recruitment ' + r.status);
    await simpanSumber('manning', await r.json());
    hasil.push({ manning: true });
  } catch (e) { hasil.push({ manning: false, error: String(e && e.message || e) }); }

  const gagal = hasil.some(h => h.error);
  res.status(gagal ? 502 : 200).json({ ok: !gagal, hasil });
}
