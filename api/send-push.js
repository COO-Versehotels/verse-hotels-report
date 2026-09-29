// ============================================================
// Vercel Serverless Function — kirim push notification (FCM HTTP v1)
// Pakai Firebase Service Account (bukan Server Key lama yang sudah
// dihapus Google).
//
// Perlu environment variable di Vercel:
//   FIREBASE_PROJECT_ID    = verse-app-98604
//   FIREBASE_CLIENT_EMAIL  = firebase-adminsdk-fbsvc@verse-app-98604.iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY   = (isi private_key dari file service account)
//   SUPABASE_URL           = https://hgbqecsmhrzlavsjwlwq.supabase.co
//   SUPABASE_ANON_KEY      = (anon/publishable key yang sudah ada)
// ============================================================

import crypto from 'crypto';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const unsigned = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = unsigned + '.' + signature;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Gagal ambil access token: ' + JSON.stringify(data));
  return data.access_token;
}

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
  const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

  if (!PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return res.status(500).json({ error: 'Kredensial Firebase belum lengkap di Vercel' });
  }

  try {
    let query = SUPA_URL + '/rest/v1/device_tokens?select=token,role,hotel';
    if (target === 'role' && targetValue) {
      query += '&role=eq.' + encodeURIComponent(targetValue);
    } else if (target === 'hotel' && targetValue) {
      query += '&hotel=eq.' + encodeURIComponent(targetValue);
    }

    const tokenResp = await fetch(query, {
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
    });
    const rows = await tokenResp.json();
    const tokens = [...new Set(rows.map(r => r.token).filter(Boolean))];

    if (tokens.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'Tidak ada device token yang cocok' });
    }

    const accessToken = await getAccessToken();

    let sent = 0, failed = 0;
    for (const token of tokens) {
      try {
        const fcmResp = await fetch(
          `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + accessToken,
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
              },
            }),
          }
        );
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
