import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.versehotels.tasklist',
  appName: 'Verse Apps',
  webDir: 'www',
  // PENTING: app Android ini memuat konten LANGSUNG dari Vercel yang sudah
  // jalan — bukan salinan beku di dalam APK. Jadi setiap kali Pak Ian upload
  // update HTML ke GitHub (alur yang sudah biasa dipakai) dan Vercel selesai
  // deploy, app Android otomatis ikut update — TANPA perlu install ulang APK.
  // Install ulang APK cuma perlu kalau ada perubahan di sisi native (izin,
  // ikon, nama plugin, dst), bukan untuk perubahan konten/tasklist biasa.
  server: {
    url: 'https://verse-hotels-report.vercel.app',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
      backgroundColor: '#1a3a5c',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a3a5c',
    },
  },
};

export default config;
