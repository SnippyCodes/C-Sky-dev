package com.example.discordqueuebot.api;

import com.example.discordqueuebot.DiscordQueuePlugin;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class WebhookManager {

    private final DiscordQueuePlugin plugin;
    private final String webhookUrl;
    private final boolean enabled;
    private final String webhookSecret;

    public WebhookManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        this.webhookUrl = plugin.getConfig().getString("webhook-url", "");
        this.enabled = plugin.getConfig().getBoolean("webhook-enabled", false);
        this.webhookSecret = plugin.getConfig().getString("webhook-secret", "");
    }

    /**
     * Send tier update to external website
     */
    public void sendTierUpdate(String ign, String gamemode, String tier, int points) {
        sendTierUpdate(ign, gamemode, tier, points, "");
    }

    /**
     * Send tier update to external website with skin URL
     */
    public void sendTierUpdate(String ign, String gamemode, String tier, int points, String skinUrl) {
        if (!enabled || webhookUrl.isEmpty()) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                String json = buildTierUpdateJson(ign, gamemode, tier, points, skinUrl == null ? "" : skinUrl);
                sendWebhook(json);
                plugin.getLogger().info("Webhook sent for " + ign + " - " + gamemode + " " + tier);
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to send webhook: " + e.getMessage());
            }
        });
    }

    /**
     * Send player removal to external website
     */
    public void sendTierRemoval(String ign, String gamemode) {
        if (!enabled || webhookUrl.isEmpty()) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                String json = buildTierRemovalJson(ign, gamemode);
                sendWebhook(json);
                plugin.getLogger().info("Webhook sent for tier removal: " + ign + " - " + gamemode);
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to send webhook: " + e.getMessage());
            }
        });
    }

    /**
     * Send leaderboard reset notification
     */
    public void sendLeaderboardReset() {
        if (!enabled || webhookUrl.isEmpty()) {
            return;
        }

        CompletableFuture.runAsync(() -> {
            try {
                String json = "{\"action\":\"reset\",\"timestamp\":" + System.currentTimeMillis() + "}";
                sendWebhook(json);
                plugin.getLogger().info("Webhook sent for leaderboard reset");
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to send webhook: " + e.getMessage());
            }
        });
    }

    private void sendWebhook(String jsonPayload) throws Exception {
        URL url = new URL(webhookUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("User-Agent", "PrimeTiersBot/2.7.0");
        if (!webhookSecret.isEmpty()) {
            conn.setRequestProperty("X-Webhook-Secret", webhookSecret);
        }
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }

        int responseCode = conn.getResponseCode();
        if (responseCode != 200 && responseCode != 201) {
            plugin.getLogger().warning("Webhook returned status code: " + responseCode);
        }

        conn.disconnect();
    }

    private String buildTierUpdateJson(String ign, String gamemode, String tier, int points, String skinUrl) {
        return String.format(
            "{\"action\":\"update\",\"ign\":\"%s\",\"gamemode\":\"%s\",\"tier\":\"%s\",\"points\":%d,\"skin_url\":\"%s\",\"timestamp\":%d}",
            escapeJson(ign),
            escapeJson(gamemode),
            escapeJson(tier),
            points,
            escapeJson(skinUrl),
            System.currentTimeMillis()
        );
    }

    private String buildTierRemovalJson(String ign, String gamemode) {
        return String.format(
            "{\"action\":\"remove\",\"ign\":\"%s\",\"gamemode\":\"%s\",\"timestamp\":%d}",
            escapeJson(ign),
            escapeJson(gamemode),
            System.currentTimeMillis()
        );
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
}
