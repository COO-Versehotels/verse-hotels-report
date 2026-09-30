package com.versehotels.tasklist;

import android.os.Build;
import android.provider.Settings;

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
