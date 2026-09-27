package com.whisperrun.chasers;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity implements AdsManager.Listener, BillingManager.Listener {
    private WebView webView;
    private MicMonitor mic;
    private AdsManager ads;
    private BillingManager billing;
    private NetworkClient network;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        mic = new MicMonitor();
        network = new NetworkClient();
        ads = new AdsManager(this, this);
        billing = new BillingManager(this, network, this);

        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new GameBridge(this, mic, ads, billing, network), "Android");
        webView.loadUrl("file:///android_asset/game/index.html");

        ads.initialize();
        billing.start();
    }

    void callJs(String script) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(script, null);
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == GameBridge.MIC_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            boolean started = granted && mic.start();
            callJs("window.WR && WR.onMicPermission(" + started + ")");
        }
    }

    @Override
    public void onRewardGranted(String rewardKey) {
        callJs("window.WR && WR.onRewarded(" + quote(rewardKey) + ")");
    }

    @Override
    public void onAdStatus(String status) {
        callJs("window.WR && WR.onAdStatus(" + quote(status) + ")");
    }

    @Override
    public void onBillingStatus(String status, String detail) {
        callJs("window.WR && WR.onBillingStatus(" + quote(status) + "," + quote(detail) + ")");
    }

    @Override
    public void onVerifiedEntitlement(String productId) {
        callJs("window.WR && WR.onEntitlement(" + quote(productId) + ")");
    }

    private static String quote(String value) {
        if (value == null) return "null";
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    @Override
    protected void onDestroy() {
        mic.stop();
        billing.stop();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
