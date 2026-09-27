package com.whisperrun.chasers;

import android.app.Activity;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class BillingManager implements PurchasesUpdatedListener {
    interface Listener {
        void onBillingStatus(String status, String detail);
        void onVerifiedEntitlement(String productId);
    }

    private static final String[] PRODUCT_IDS = {
            "cosmetic_dead_orbit_founder",
            "season_pass_s1",
            "recovery_pack_s1"
    };

    private final Activity activity;
    private final Listener listener;
    private final NetworkClient network;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private final BillingClient billingClient;

    BillingManager(Activity activity, NetworkClient network, Listener listener) {
        this.activity = activity;
        this.network = network;
        this.listener = listener;
        PendingPurchasesParams pending = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();
        billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(pending)
                .enableAutoServiceReconnection()
                .build();
    }

    void start() {
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK) queryProducts();
                else listener.onBillingStatus("setup_failed", billingResult.getDebugMessage());
            }

            @Override
            public void onBillingServiceDisconnected() {
                listener.onBillingStatus("disconnected", "Play Billing disconnected");
            }
        });
    }

    private void queryProducts() {
        List<QueryProductDetailsParams.Product> productList = new ArrayList<>();
        for (String id : PRODUCT_IDS) {
            productList.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build());
        }
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(productList)
                .build();
        billingClient.queryProductDetailsAsync(params, this::onProductDetails);
    }

    private void onProductDetails(BillingResult result, QueryProductDetailsResult detailsResult) {
        if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            listener.onBillingStatus("query_failed", result.getDebugMessage());
            return;
        }
        products.clear();
        for (ProductDetails detail : detailsResult.getProductDetailsList()) products.put(detail.getProductId(), detail);
        listener.onBillingStatus("ready", Integer.toString(products.size()));
    }

    void buy(String productId) {
        activity.runOnUiThread(() -> {
            ProductDetails detail = products.get(productId);
            if (detail == null) {
                listener.onBillingStatus("product_unavailable", productId);
                queryProducts();
                return;
            }
            BillingFlowParams.ProductDetailsParams.Builder pd = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(detail);
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = detail.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty()) pd.setOfferToken(offers.get(0).getOfferToken());
            List<BillingFlowParams.ProductDetailsParams> items = new ArrayList<>();
            items.add(pd.build());
            BillingFlowParams flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(items).build();
            BillingResult launch = billingClient.launchBillingFlow(activity, flow);
            if (launch.getResponseCode() != BillingClient.BillingResponseCode.OK) listener.onBillingStatus("launch_failed", launch.getDebugMessage());
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult billingResult, List<Purchase> purchases) {
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK || purchases == null) {
            listener.onBillingStatus("purchase_not_completed", billingResult.getDebugMessage());
            return;
        }
        for (Purchase purchase : purchases) verifyOnServer(purchase);
    }

    private void verifyOnServer(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
            listener.onBillingStatus("purchase_pending", "pending");
            return;
        }
        if (!network.enabled()) {
            listener.onBillingStatus("verification_required", "Configure API_BASE_URL before paid release");
            return;
        }
        try {
            JSONObject request = new JSONObject();
            request.put("purchaseToken", purchase.getPurchaseToken());
            request.put("packageName", activity.getPackageName().replace(".debug", ""));
            JSONArray ids = new JSONArray();
            for (String product : purchase.getProducts()) ids.put(product);
            request.put("productIds", ids);
            network.post("/v1/purchase/verify", request.toString(), (code, body) -> {
                if (code < 200 || code >= 300) {
                    listener.onBillingStatus("verification_failed", body);
                    return;
                }
                try {
                    JSONObject response = new JSONObject(body);
                    if (!response.optBoolean("verified", false)) {
                        listener.onBillingStatus("verification_failed", body);
                        return;
                    }
                    if (!purchase.isAcknowledged()) {
                        AcknowledgePurchaseParams ack = AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build();
                        billingClient.acknowledgePurchase(ack, ackResult -> {});
                    }
                    for (String product : purchase.getProducts()) listener.onVerifiedEntitlement(product);
                } catch (Exception ex) {
                    listener.onBillingStatus("verification_failed", "bad_server_response");
                }
            });
        } catch (Exception ex) {
            listener.onBillingStatus("verification_failed", "request_error");
        }
    }

    void stop() {
        billingClient.endConnection();
    }
}
