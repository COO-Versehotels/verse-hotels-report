// ============================================================
// Vercel Serverless Function — kirim push notification GRPS Dashboard
// (Complaint / Comment tamu) ke APK "GRPS Dashboard" lewat FCM HTTP v1.
//
// Alur (tanpa kunci rahasia tambahan):
//   1. Apps Script GRPS menemukan complaint/comment baru, menyimpan isi
//      pesan + daftar HP tujuan, lalu memanggil fungsi ini dengan sebuah
//      KODE SEKALI PAKAI (nonce).
//   2. Fungsi ini menukar nonce itu ke Apps Script GRPS untuk mendapatkan
//      isi pesannya. Nonce acak/palsu tidak menghasilkan apa-apa, jadi
//      orang luar tidak bisa memakai fungsi ini untuk mengirim pesan.
//   3. Pesan dikirim ke FCM memakai kredensial Firebase yang sama dengan
//      /api/send-push (env FIREBASE_* di Vercel).
// ============================================================

import crypto from 'crypto';

const GRPS_EXEC_URL = 'https://script.google.com/macros/s/AKfycbwGs35ukef2BTg7ledVb0LdyWnnKmLhjOQ7pvO-8OeAg3AZ512hQ8-3UqD9cnk41IO4qQ/exec';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function normalizePrivateKey(raw) {
  let k = String(raw || '').trim();
  if (k.startsWith('{')) { try { k = JSON.parse(k).private_key || k; } catch (e) {} }
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) k = k.slice(1, -1);
  k = k.replace(/\\n/g, '\n').replace(/\r/g, '');
  const m = k.match(/-----BEGIN ([A-Z ]*PRIVATE KEY)-----([\s\S]*?)-----END \1-----/);
  if (m) {
    const body = m[2].replace(/[^A-Za-z0-9+/=]/g, '');
    k = '-----BEGIN ' + m[1] + '-----\n' + body.match(/.{1,64}/g).join('\n') + '\n-----END ' + m[1] + '-----\n';
  }
  return k;
}

function firebaseCreds() {
  let sa = null;
  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT || (String(process.env.FIREBASE_PRIVATE_KEY || '').trim().startsWith('{') ? process.env.FIREBASE_PRIVATE_KEY : '');
  if (rawSa) { try { sa = JSON.parse(rawSa); } catch (e) {} }
  return {
    projectId: String(process.env.FIREBASE_PROJECT_ID || (sa && sa.project_id) || '').trim().replace(/^["']|["']$/g, ''),
    clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL || (sa && sa.client_email) || '').trim().replace(/^["']|["']$/g, ''),
    privateKey: normalizePrivateKey((sa && sa.private_key) || process.env.FIREBASE_PRIVATE_KEY),
  };
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + base64url(JSON.stringify({
    iss: creds.clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(creds.privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + unsigned + '.' + signature,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Gagal ambil access token');
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const nonce = String((req.body && req.body.nonce) || '');
  if (!/^[A-Za-z0-9-]{30,120}$/.test(nonce)) return res.status(400).json({ error: 'nonce tidak valid' });

  const creds = firebaseCreds();
  if (!creds.projectId || !creds.clientEmail || !creds.privateKey) {
    return res.status(500).json({ error: 'Kredensial Firebase belum lengkap di Vercel' });
  }

  try {
    // Tukar nonce -> isi pesan (hanya Apps Script GRPS yang tahu nonce yang sah)
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(GRPS_EXEC_URL + '?pushNonce=' + encodeURIComponent(nonce), { redirect: 'follow', signal: ctrl.signal });
    clearTimeout(timer);
    let payload = null;
    try { payload = JSON.parse(await r.text()); } catch (e) { payload = null; }
    const messages = ((payload && payload.messages) || []).slice(0, 60);
    if (!messages.length) return res.status(200).json({ success: true, sent: 0, failed: 0, invalid: [], message: 'Tidak ada pesan untuk nonce ini' });

    const accessToken = await getAccessToken(creds);
    let sent = 0, failed = 0;
    const invalid = [];
    for (const msg of messages) {
      const title = String(msg.title || '').slice(0, 120);
      const body = String(msg.body || '').slice(0, 500);
      const tokens = [...new Set((msg.tokens || []).filter(Boolean).map(String))].slice(0, 300);
      if (!title || !tokens.length) continue;
      for (const token of tokens) {
        try {
          const fcmResp = await fetch(`https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + accessToken },
            body: JSON.stringify({ message: {
              token,
              notification: { title, body },
              data: { open: 'notif' },
              android: {
                priority: 'HIGH',
                notification: { channel_id: 'grps_alerts', default_sound: true, default_vibrate_timings: true, notification_priority: 'PRIORITY_HIGH', visibility: 'PUBLIC' },
              },
            } }),
          });
          if (fcmResp.ok) { sent++; }
          else {
            failed++;
            if (fcmResp.status === 404 || fcmResp.status === 400) {
              const t = await fcmResp.text();
              if (/UNREGISTERED|INVALID_ARGUMENT/.test(t)) invalid.push(token);
            }
          }
        } catch (e) { failed++; }
      }
    }
    return res.status(200).json({ success: true, sent, failed, invalid: [...new Set(invalid)] });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
