// ============================================================
// Vercel Serverless Function — sinkron data GRPS untuk Live Score KPI
// Dipanggil pg_cron (Supabase) tiap ±30 menit: POST {auth}
// 1) ambil Apps Script GRPS mode=kpi (bulan ini; tgl 1–5 juga bulan lalu)
// 2) simpan ke Supabase lewat RPC grps_kpi_simpan (auth dicek di DB)
// ============================================================
export const config = { maxDuration: 60 };

const GRPS_API_URL = 'https://script.google.com/macros/s/AKfycbz3b0dZeU2TMYT2x9V9SjhE8rlK5aDDhJ1hM2OnBrX1KawBpFkBCSu7kqF5pbT2eGWSyQ/exec';
const GRPS_API_KEY = 'verse-grps-rating-2026';

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
  const gagal = hasil.some(h => h.error);
  res.status(gagal ? 502 : 200).json({ ok: !gagal, hasil });
}
