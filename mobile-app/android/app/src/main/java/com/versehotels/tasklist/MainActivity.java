package com.versehotels.tasklist;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.ImageView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    // Splash penuh (logo Verse + 4 unit) tampil minimal 2 detik,
    // sampai halaman selesai dimuat, maksimal 10 detik.
    private static final long MIN_SPLASH_MS = 2000;
    private static final long MAX_SPLASH_MS = 10000;

    private ImageView splashOverlay;
    private long splashShownAt;
    private boolean pageLoaded = false;
    private boolean splashDismissed = false;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(VerseBiometricPlugin.class);
        super.onCreate(savedInstanceState);
        showSplashOverlay();
    }

    private void showSplashOverlay() {
        try {
            splashOverlay = new ImageView(this);
            splashOverlay.setImageResource(R.drawable.splash);
            splashOverlay.setScaleType(ImageView.ScaleType.FIT_CENTER);
            splashOverlay.setBackgroundColor(Color.parseColor("#1A3A5C"));
            splashOverlay.setClickable(true); // tahan sentuhan selama splash tampil
            addContentView(
                splashOverlay,
                new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            );
            splashShownAt = System.currentTimeMillis();

            if (bridge != null) {
                bridge.addWebViewListener(
                    new WebViewListener() {
                        @Override
                        public void onPageLoaded(WebView webView) {
                            onPageReady();
                        }

                        @Override
                        public void onReceivedError(WebView webView) {
                            onPageReady();
                        }
                    }
                );
            }
            handler.postDelayed(this::dismissSplash, MAX_SPLASH_MS);
        } catch (Exception e) {
            splashOverlay = null;
        }
    }

    private void onPageReady() {
        if (pageLoaded) return;
        pageLoaded = true;
        long elapsed = System.currentTimeMillis() - splashShownAt;
        handler.postDelayed(this::dismissSplash, Math.max(0, MIN_SPLASH_MS - elapsed));
    }

    private void dismissSplash() {
        if (splashDismissed || splashOverlay == null) return;
        splashDismissed = true;
        final View v = splashOverlay;
        v.animate().alpha(0f).setDuration(350).withEndAction(() -> {
            ViewGroup parent = (ViewGroup) v.getParent();
            if (parent != null) parent.removeView(v);
        }).start();
    }
}
