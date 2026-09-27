package com.whisperrun.chasers;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.util.UUID;

final class GameBridge {
    static final int MIC_PERMISSION_REQUEST = 7001;
    private final MainActivity activity;
    private final SharedPreferences prefs;
    private final MicMonitor mic;
    private final AdsManager ads;
    private final BillingManager billing;
    private final NetworkClient network;

    GameBridge(MainActivity activity, MicMonitor mic, AdsManager ads, BillingManager billing, NetworkClient network) {
        this.activity = activity;
        this.mic = mic;
        this.ads = ads;
        this.billing = billing;
        this.network = network;
        this.prefs = activity.getSharedPreferences("whisper_run", Context.MODE_PRIVATE);
    }

    @JavascriptInterface
    public void saveGame(String json) {
        if (json != null && json.length() <= 250_000) prefs.edit().putString("save", json).apply();
    }

    @JavascriptInterface
    public String loadGame() {
        return prefs.getString("save", "{}");
    }

    @JavascriptInterface
    public String getInstallId() {
        String id = prefs.getString("install_id", null);
        if (id == null) {
            id = UUID.randomUUID().toString();
            prefs.edit().putString("install_id", id).apply();
        }
        return id;
    }

    @JavascriptInterface
    public void requestMicrophone() {
        activity.runOnUiThread(() -> {
            if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                boolean ok = mic.start();
                activity.callJs("window.WR && WR.onMicPermission(" + ok + ")");
            } else {
                activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_PERMISSION_REQUEST);
            }
        });
    }

    @JavascriptInterface
    public void stopMicrophone() { mic.stop(); }

    @JavascriptInterface
    public double getNoiseLevel() { return mic.getNoiseLevel(); }

    @JavascriptInterface
    public void showRewardedAd(String rewardKey) { ads.showRewarded(rewardKey == null ? "decoy" : rewardKey); }

    @JavascriptInterface
    public void showPrivacyOptions() { ads.showPrivacyOptions(); }

    @JavascriptInterface
    public void buy(String productId) {
        if (productId != null && productId.length() < 100) billing.buy(productId);
    }

    @JavascriptInterface
    public void fetchRemoteConfig() {
        network.get("/v1/config", (code, body) -> activity.callJs(
                "window.WR && WR.onRemoteConfig(" + JSONObject.quote(body) + "," + code + ")"));
    }

    @JavascriptInterface
    public void syncProgress(String json) {
        if (json == null || json.length() > 250_000) return;
        network.post("/v1/save", json, (code, body) -> activity.callJs(
                "window.WR && WR.onSync(" + code + ")"));
    }
}
