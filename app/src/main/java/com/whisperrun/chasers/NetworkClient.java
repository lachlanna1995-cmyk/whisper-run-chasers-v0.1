package com.whisperrun.chasers;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class NetworkClient {
    interface Callback { void complete(int code, String body); }
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    boolean enabled() {
        return BuildConfig.API_BASE_URL != null && !BuildConfig.API_BASE_URL.trim().isEmpty();
    }

    void get(String path, Callback callback) { request("GET", path, null, callback); }
    void post(String path, String body, Callback callback) { request("POST", path, body, callback); }

    private void request(String method, String path, String body, Callback callback) {
        if (!enabled()) {
            callback.complete(0, "{\"offline\":true}");
            return;
        }
        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(BuildConfig.API_BASE_URL.replaceAll("/$", "") + path);
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod(method);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(7000);
                conn.setRequestProperty("Accept", "application/json");
                if (body != null) {
                    conn.setDoOutput(true);
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }
                int code = conn.getResponseCode();
                BufferedReader reader = new BufferedReader(new InputStreamReader(
                        code >= 200 && code < 400 ? conn.getInputStream() : conn.getErrorStream(),
                        StandardCharsets.UTF_8));
                StringBuilder result = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) result.append(line);
                reader.close();
                callback.complete(code, result.toString());
            } catch (Exception ex) {
                callback.complete(-1, "{\"error\":\"network\"}");
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }
}
