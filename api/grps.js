// ============================================================
// Vercel Serverless Function — proxy rating GRPS untuk kartu HM
// App memanggil /api/grps?role=HM%20Verse%20Luxe (domain sendiri),
// server Vercel yang mengambil data ke Google Apps Script GRPS.
// Lebih stabil daripada HP langsung ke script.google.com.
// ============================================================

const GRPS_API_URL = 'https://script.google.com/macros/s/AKfycbz3b0dZeU2TMYT2x9V9SjhE8rlK5aDDhJ1hM2OnBrX1KawBpFkBCSu7kqF5pbT2eGWSyQ/exec';
const GRPS_API_KEY = 'verse-grps-rating-2026';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const role = String((req.query && req.query.role) || '');
  if (!role.startsWith('HM ')) {
    res.status(400).json({ success: false, error: 'Role tidak valid' });
    return;
  }
  const url = GRPS_API_URL + '?key=' + encodeURIComponent(GRPS_API_KEY) + '&role=' + encodeURIComponent(role);

  let lastErr = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
      clearTimeout(timer);
      const text = await r.text();
      const data = JSON.parse(text);
      // Cache di edge Vercel 5 menit supaya cepat & hemat kuota Apps Script
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      res.status(200).json(data);
      return;
    } catch (e) {
      lastErr = e && e.name === 'AbortError' ? 'Timeout ke server GRPS' : String(e && e.message || e);
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(502).json({ success: false, error: 'Server rating tidak merespons (' + lastErr + ')' });
}
