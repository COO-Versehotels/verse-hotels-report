// ============================================================
// Vercel Serverless Function — kirim push notification (FCM)
// Dipakai untuk: reminder otomatis (dipanggil GitHub Actions cron)
// dan Broadcast Message dari Dashboard COO.
//
// Perlu environment variable di Vercel:
//   FIREBASE_SERVER_KEY   = Server Key dari Firebase Console
//   SUPABASE_URL          = https://hgbqecsmhrzlavsjwlwq.supabase.co
//   SUPABASE_ANON_KEY     = (anon/publishable key yang sudah ada)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { target, targetValue, title, body } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: 'title dan body wajib diisi' });
  }

  const SUPA_URL = process.env.SUPABASE_URL || 'https://hgbqecsmhrzlavsjwlwq.supabase.co';
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_KeAmOu9ex8r1PDRI1MRMsQ_40uiEkbM';
  const FCM_SERVER_KEY = process.env.FIREBASE_SERVER_KEY;

  if (!FCM_SERVER_KEY) {
    return res.status(500).json({ error: 'FIREBASE_SERVER_KEY belum di-set di Vercel' });
  }

  try {
    // 1. Ambil device token yang relevan dari Supabase
    let query = SUPA_URL + '/rest/v1/device_tokens?select=token,role,hotel';
    if (target === 'role' && targetValue) {
      query += '&role=eq.' + encodeURIComponent(targetValue);
    } else if (target === 'hotel' && targetValue) {
      query += '&hotel=eq.' + encodeURIComponent(targetValue);
    }
    // target === 'all' -> tidak ada filter tambahan

    const tokenResp = await fetch(query, {
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    });
    const rows = await tokenResp.json();
    const tokens = [...new Set(rows.map(r => r.token).filter(Boolean))];

    if (tokens.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'Tidak ada device token yang cocok' });
    }

    // 2. Kirim ke Firebase Cloud Messaging (legacy HTTP API, kirim per token)
    let sent = 0, failed = 0;
    for (const token of tokens) {
      try {
        const fcmResp = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'key=' + FCM_SERVER_KEY,
          },
          body: JSON.stringify({
            to: token,
            notification: { title, body },
            priority: 'high',
          }),
        });
        if (fcmResp.ok) sent++; else failed++;
      } catch (e) {
        failed++;
      }
    }

    return res.status(200).json({ success: true, sent, failed, total: tokens.length });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
