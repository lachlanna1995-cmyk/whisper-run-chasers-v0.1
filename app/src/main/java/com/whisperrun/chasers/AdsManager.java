package com.whisperrun.chasers;

import android.app.Activity;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

final class AdsManager {
    interface Listener {
        void onRewardGranted(String rewardKey);
        void onAdStatus(String status);
    }

    private final Activity activity;
    private final Listener listener;
    private ConsentInformation consentInformation;
    private RewardedAd rewardedAd;
    private boolean initialized;

    AdsManager(Activity activity, Listener listener) {
        this.activity = activity;
        this.listener = listener;
    }

    void initialize() {
        consentInformation = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consentInformation.requestConsentInfoUpdate(
                activity,
                params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(
                        activity,
                        formError -> initAdsIfAllowed()),
                requestConsentError -> initAdsIfAllowed());
    }

    private void initAdsIfAllowed() {
        if (initialized) return;
        if (consentInformation != null && !consentInformation.canRequestAds()) {
            listener.onAdStatus("consent_required");
            return;
        }
        initialized = true;
        MobileAds.initialize(activity, status -> loadRewarded());
    }

    private void loadRewarded() {
        RewardedAd.load(
                activity,
                BuildConfig.REWARDED_AD_UNIT_ID,
                new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(RewardedAd ad) {
                        rewardedAd = ad;
                        listener.onAdStatus("ready");
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        rewardedAd = null;
                        listener.onAdStatus("unavailable");
                    }
                });
    }

    void showRewarded(String rewardKey) {
        activity.runOnUiThread(() -> {
            if (rewardedAd == null) {
                listener.onAdStatus("not_ready");
                loadRewarded();
                return;
            }
            RewardedAd ad = rewardedAd;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdDismissedFullScreenContent() {
                    rewardedAd = null;
                    loadRewarded();
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError adError) {
                    rewardedAd = null;
                    listener.onAdStatus("show_failed");
                    loadRewarded();
                }
            });
            ad.show(activity, rewardItem -> listener.onRewardGranted(rewardKey));
        });
    }

    void showPrivacyOptions() {
        activity.runOnUiThread(() -> UserMessagingPlatform.showPrivacyOptionsForm(
                activity,
                formError -> initAdsIfAllowed()));
    }
}
