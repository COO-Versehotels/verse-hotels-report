# Verse Hotels Tasklist — Android App

Wrapper Android (Capacitor) untuk web app di [verse-hotels-report.vercel.app](https://verse-hotels-report.vercel.app).

**Penting:** app ini memuat konten LANGSUNG dari Vercel (lihat `server.url` di
`capacitor.config.ts`), bukan salinan beku di dalam APK. Jadi update konten
tasklist (upload HTML baru → Vercel auto-deploy) otomatis muncul di app,
**tanpa perlu rebuild/install ulang APK**.

## Cara Dapat APK Terbaru

1. Buka tab **Actions** di repo GitHub ini
2. Pilih workflow **"Build Android APK"**
3. Klik **"Run workflow"** (kalau mau build manual) — atau tunggu build
   otomatis kalau ada perubahan ke folder `mobile-app/`
4. Setelah selesai (~5-10 menit), buka tab **Releases** di repo ini
5. Download file `.apk` di release terbaru, install ke HP Android

## Struktur

- `www/` — placeholder wajib untuk Capacitor (app sebenarnya tidak
  memuat isi folder ini karena pakai `server.url`)
- `android/` — project native Android (jangan diedit manual kecuali paham
  Android/Gradle)
- `capacitor.config.ts` — konfigurasi utama (appId, appName, server URL,
  splash screen)
