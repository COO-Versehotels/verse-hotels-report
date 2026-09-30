package com.versehotels.tasklist;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * Fingerprint native untuk Verse Apps.
 * JS: Capacitor.Plugins.VerseBiometric.isAvailable() / .verify({title, subtitle})
 * verify() selalu resolve: { verified: true } atau { verified: false, error, code }.
 * getDeviceInfo(): { androidId, manufacturer, model } — ID bawaan HP, tetap sama
 * walaupun app di-uninstall/install ulang (selama kunci tanda tangan APK sama).
 */
@CapacitorPlugin(name = "VerseBiometric")
public class VerseBiometricPlugin extends Plugin {

    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        int result = BiometricManager.from(getContext()).canAuthenticate(AUTHENTICATORS);
        JSObject ret = new JSObject();
        ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("code", result);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        String androidId = "";
        try {
            androidId = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        } catch (Exception e) {
            androidId = "";
        }
        ret.put("androidId", androidId == null ? "" : androidId);
        ret.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        ret.put("model", Build.MODEL == null ? "" : Build.MODEL);
        call.resolve(ret);
    }

    private static byte[] decodeBase64(String b64) {
        if (b64 == null) return null;
        int comma = b64.indexOf(',');
        if (b64.startsWith("data:") && comma > 0) b64 = b64.substring(comma + 1);
        return Base64.decode(b64, Base64.DEFAULT);
    }

    /** Simpan foto ke galeri HP (album "Verse Apps"). Resolve: { saved, uri } */
    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            byte[] bytes = decodeBase64(call.getString("base64"));
            if (bytes == null || bytes.length == 0) { ret.put("saved", false); ret.put("error", "kosong"); call.resolve(ret); return; }
            String name = call.getString("fileName", "verse_" + System.currentTimeMillis() + ".jpg");
            String mime = call.getString("mimeType", "image/jpeg");
            Uri uri;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                values.put(MediaStore.Images.Media.MIME_TYPE, mime);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Verse Apps");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception("Gagal membuat file galeri");
                try (OutputStream os = resolver.openOutputStream(uri)) { os.write(bytes); }
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    ret.put("saved", false); ret.put("error", "permission"); call.resolve(ret); return;
                }
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Verse Apps");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, name);
                try (FileOutputStream fos = new FileOutputStream(f)) { fos.write(bytes); }
                MediaScannerConnection.scanFile(getContext(), new String[] { f.getAbsolutePath() }, new String[] { mime }, null);
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            }
            ret.put("saved", true);
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("saved", false);
            ret.put("error", String.valueOf(e.getMessage()));
            call.resolve(ret);
        }
    }

    /** Bagikan foto lewat menu share Android (WA, dll). Pakai uri galeri atau base64. */
    @PluginMethod
    public void shareImage(PluginCall call) {
        try {
            Uri uri = null;
            String uriStr = call.getString("uri");
            if (uriStr != null && !uriStr.isEmpty()) {
                uri = Uri.parse(uriStr);
            } else {
                byte[] bytes = decodeBase64(call.getString("base64"));
                if (bytes != null && bytes.length > 0) {
                    File dir = new File(getContext().getCacheDir(), "share");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, call.getString("fileName", "verse_foto.jpg"));
                    try (FileOutputStream fos = new FileOutputStream(f)) { fos.write(bytes); }
                    uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
                }
            }
            if (uri == null) { call.reject("Foto tidak tersedia"); return; }
            // Pastikan foto bisa dibaca (uri galeri lama bisa sudah dihapus)
            try (java.io.InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in == null) throw new Exception("tidak bisa dibaca");
            }
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/jpeg");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            String text = call.getString("text", "");
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Bagikan foto");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membagikan: " + e.getMessage());
        }
    }

    @PluginMethod
    public void verify(final PluginCall call) {
        final String title = call.getString("title", "Buka Verse Apps");
        final String subtitle = call.getString("subtitle", "Tempelkan jari untuk masuk");

        getActivity().runOnUiThread(() -> {
            final boolean[] done = { false };
            Executor executor = ContextCompat.getMainExecutor(getContext());
            BiometricPrompt prompt = new BiometricPrompt(
                getActivity(),
                executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        if (done[0]) return;
                        done[0] = true;
                        JSObject ret = new JSObject();
                        ret.put("verified", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        if (done[0]) return;
                        done[0] = true;
                        JSObject ret = new JSObject();
                        ret.put("verified", false);
                        ret.put("code", errorCode);
                        ret.put("error", errString.toString());
                        call.resolve(ret);
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        // Jari tidak cocok — dialog tetap terbuka, user bisa coba lagi.
                    }
                }
            );

            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setNegativeButtonText("Pakai PIN")
                .setAllowedAuthenticators(AUTHENTICATORS)
                .build();

            try {
                prompt.authenticate(info);
            } catch (Exception e) {
                if (!done[0]) {
                    done[0] = true;
                    JSObject ret = new JSObject();
                    ret.put("verified", false);
                    ret.put("error", String.valueOf(e.getMessage()));
                    call.resolve(ret);
                }
            }
        });
    }
}
