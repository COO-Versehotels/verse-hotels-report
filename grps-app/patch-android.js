// Dijalankan oleh workflow build SETELAH `npx cap add android`.
// Menyesuaikan project Android hasil generate: nomor versi otomatis, tanda tangan
// tetap, izin notifikasi, konfigurasi Firebase, dan ikon (sama dengan Verse Apps).
const fs = require('fs');
const path = require('path');

const app = path.join(__dirname, 'android', 'app');
const res = path.join(app, 'src', 'main', 'res');
function must(cond, msg) { if (!cond) { console.error('PATCH GAGAL: ' + msg); process.exit(1); } }

// 1) build.gradle — versi dari nomor build GitHub + kunci tanda tangan tetap
let g = fs.readFileSync(path.join(app, 'build.gradle'), 'utf8');
must(g.includes('versionCode 1') && g.includes('versionName "1.0"') && g.includes('    buildTypes {'), 'template build.gradle berubah');
g = g.replace('versionCode 1', 'versionCode ((System.getenv("GITHUB_RUN_NUMBER") ?: "1") as Integer)');
g = g.replace('versionName "1.0"', 'versionName "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")');
g = g.replace('    buildTypes {', [
  '    // Kunci tanda tangan TETAP (dari GitHub Secrets) - update APK tidak perlu uninstall',
  '    def verseKeystore = file("verse-release.jks")',
  '    signingConfigs {',
  '        verse {',
  '            if (verseKeystore.exists()) {',
  '                storeFile verseKeystore',
  '                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")',
  '                keyAlias "verseapps"',
  '                keyPassword System.getenv("ANDROID_KEYSTORE_PASSWORD")',
  '            }',
  '        }',
  '    }',
  '    buildTypes {',
  '        debug {',
  '            if (verseKeystore.exists()) {',
  '                signingConfig signingConfigs.verse',
  '            }',
  '        }',
].join('\n'));
fs.writeFileSync(path.join(app, 'build.gradle'), g);

// 2) AndroidManifest — izin notifikasi (Android 13+) + channel default untuk push
const mf = path.join(app, 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(mf, 'utf8');
must(m.includes('<uses-permission android:name="android.permission.INTERNET" />') && m.includes('</application>'), 'template AndroidManifest berubah');
if (!m.includes('POST_NOTIFICATIONS')) {
  m = m.replace('<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />');
}
if (!m.includes('default_notification_channel_id')) {
  m = m.replace('</application>',
    '    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="grps_alerts" />\n    </application>');
}
fs.writeFileSync(mf, m);

// 3) Firebase
fs.copyFileSync(path.join(__dirname, 'google-services.json'), path.join(app, 'google-services.json'));

// 4) Ikon & splash dasar: salin milik Verse Apps (mobile-app); ikon lalu diganti di langkah 5
const src = path.join(__dirname, '..', 'mobile-app', 'android', 'app', 'src', 'main', 'res');
let copied = 0;
if (fs.existsSync(src)) {
  for (const dir of fs.readdirSync(src)) {
    const from = path.join(src, dir);
    if (!fs.statSync(from).isDirectory()) continue;
    for (const f of fs.readdirSync(from)) {
      const isIcon = dir.startsWith('mipmap-') || /^ic_launcher/.test(f);
      const isSplash = /^splash/.test(f);
      if (!isIcon && !isSplash) continue;
      fs.mkdirSync(path.join(res, dir), { recursive: true });
      fs.copyFileSync(path.join(from, f), path.join(res, dir, f));
      copied++;
    }
  }
}
// 5) Ikon khusus GRPS: gaya sama dengan Verse Recruitment / Verse Defect
//    (logo Verse asli + pita biru bertulisan GRPS DASHBOARD). Dibuat oleh make-icons.py.
const { execSync } = require('child_process');
const sh = (c) => execSync(c, { stdio: 'inherit', cwd: __dirname });
try { execSync('python3 -c "import PIL"', { stdio: 'ignore' }); }
catch (e) {
  try { sh('python3 -m pip install --quiet --user --break-system-packages pillow'); }
  catch (e2) { sh('sudo apt-get install -y -qq python3-pil'); }
}
const font = path.join(__dirname, 'Poppins-Bold.ttf');
if (!fs.existsSync(font)) sh('curl -fsSL --retry 3 -o Poppins-Bold.ttf https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf');
must(fs.existsSync(font) && fs.statSync(font).size > 50000, 'font Poppins-Bold.ttf gagal diunduh');
sh('python3 make-icons.py Poppins-Bold.ttf');

// 6) Splash sama seperti Verse Apps: splash sistem navy + logo, lalu splash penuh
//    (logo Verse + 4 unit) minimal 2 detik sampai halaman siap.
const stylesFile = path.join(res, 'values', 'styles.xml');
must(fs.existsSync(stylesFile), 'styles.xml tidak ditemukan');
must(fs.existsSync(path.join(res, 'drawable', 'splash.png')), 'drawable/splash.png tidak ada');
must(fs.readdirSync(res).some((d) => d.startsWith('drawable') && fs.existsSync(path.join(res, d, 'splash_icon.png'))), 'splash_icon.png tidak ada');
must(fs.readFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), 'utf8').includes('splash_navy'), 'warna splash_navy tidak ada');
fs.writeFileSync(stylesFile, [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<resources>',
  '    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">',
  '        <item name="colorPrimary">@color/colorPrimary</item>',
  '        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>',
  '        <item name="colorAccent">@color/colorAccent</item>',
  '    </style>',
  '    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">',
  '        <item name="windowActionBar">false</item>',
  '        <item name="windowNoTitle">true</item>',
  '        <item name="android:background">@null</item>',
  '    </style>',
  '    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">',
  '        <item name="windowSplashScreenBackground">@color/splash_navy</item>',
  '        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>',
  '        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>',
  '    </style>',
  '</resources>',
  '',
].join('\n'));
const mainJava = path.join(app, 'src', 'main', 'java', 'com', 'versehotels', 'grps', 'MainActivity.java');
must(fs.existsSync(mainJava), 'MainActivity.java tidak ditemukan');
fs.copyFileSync(path.join(__dirname, 'MainActivity.java'), mainJava);

console.log('Patch Android selesai. File ikon/splash disalin: ' + copied);
