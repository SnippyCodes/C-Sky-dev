package com.example.discordqueuebot.api;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.manager.TierLeaderboardManager;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.Executors;

public final class WebAPIServer {

    private final DiscordQueuePlugin plugin;
    private final TierLeaderboardManager tierManager;
    private HttpServer server;
    private final int port;

    public WebAPIServer(DiscordQueuePlugin plugin, TierLeaderboardManager tierManager) {
        this.plugin = plugin;
        this.tierManager = tierManager;
        this.port = plugin.getConfig().getInt("api-port", 8080);
    }

    public void start() {
        try {
            // Bind to 0.0.0.0 to accept connections from all interfaces
            server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
            server.setExecutor(Executors.newFixedThreadPool(4));

            // API Endpoints
            server.createContext("/api/players", this::handlePlayers);
            server.createContext("/api/leaderboard", this::handleLeaderboard);
            server.createContext("/api/testers", this::handleTesters);
            server.createContext("/api/stats", this::handleStats);

            server.start();
            plugin.getLogger().info("✅ Web API started on 0.0.0.0:" + port);
            plugin.getLogger().info("📡 API Endpoints available at http://[SERVER_IP]:" + port + "/api/*");
        } catch (IOException e) {
            plugin.getLogger().severe("❌ Failed to start Web API on port " + port + ": " + e.getMessage());
            plugin.getLogger().severe("💡 Make sure port " + port + " is allocated in Pterodactyl panel!");
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            plugin.getLogger().info("Web API stopped");
        }
    }

    private void handlePlayers(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> players = new ArrayList<>();

        // Get all players with tiers
        Map<String, Map<String, String>> allTiers = tierManager.getAllPlayerTiers();
        
        // Build IGN -> skin URL map from registrations
        Map<String, String> skinByIgn = new HashMap<>();
        try {
            for (com.example.discordqueuebot.model.RegistrationProfile profile :
                    plugin.getRegistrationManager().getAllProfiles()) {
                if (profile.ign() != null && !profile.ign().isBlank()
                        && profile.skinUrl() != null && !profile.skinUrl().isBlank()) {
                    skinByIgn.put(profile.ign().toLowerCase(), profile.skinUrl());
                }
            }
        } catch (Exception ignored) {}

        for (Map.Entry<String, Map<String, String>> entry : allTiers.entrySet()) {
            String ign = entry.getKey();
            Map<String, String> tiers = entry.getValue();
            
            Map<String, Object> playerData = new HashMap<>();
            playerData.put("ign", ign);
            playerData.put("tiers", tiers);
            playerData.put("totalPoints", calculateTotalPoints(tiers));
            playerData.put("skin_url", skinByIgn.getOrDefault(ign.toLowerCase(), ""));
            
            players.add(playerData);
        }

        response.put("players", players);
        response.put("count", players.size());
        
        sendResponse(exchange, 200, response);
    }

    private void handleLeaderboard(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        String query = exchange.getRequestURI().getQuery();
        String gamemode = null;
        
        if (query != null && query.startsWith("gamemode=")) {
            gamemode = query.substring(9);
        }

        Map<String, Object> response = new HashMap<>();
        
        if (gamemode != null && !gamemode.isEmpty()) {
            // Specific gamemode leaderboard
            Map<String, String> leaderboard = tierManager.getLeaderboard(gamemode);
            List<Map<String, Object>> entries = new ArrayList<>();
            
            int rank = 1;
            for (Map.Entry<String, String> entry : leaderboard.entrySet()) {
                Map<String, Object> playerEntry = new HashMap<>();
                playerEntry.put("rank", rank++);
                playerEntry.put("ign", entry.getKey());
                playerEntry.put("tier", entry.getValue());
                playerEntry.put("points", TierLeaderboardManager.TIER_POINTS.getOrDefault(entry.getValue(), 0));
                entries.add(playerEntry);
            }
            
            response.put("gamemode", gamemode);
            response.put("leaderboard", entries);
        } else {
            // Overall leaderboard
            Map<String, Integer> overallLeaderboard = tierManager.getOverallLeaderboard();
            List<Map<String, Object>> entries = new ArrayList<>();
            
            int rank = 1;
            for (Map.Entry<String, Integer> entry : overallLeaderboard.entrySet()) {
                Map<String, Object> playerEntry = new HashMap<>();
                playerEntry.put("rank", rank++);
                playerEntry.put("ign", entry.getKey());
                playerEntry.put("totalPoints", entry.getValue());
                entries.add(playerEntry);
            }
            
            response.put("gamemode", "overall");
            response.put("leaderboard", entries);
        }
        
        sendResponse(exchange, 200, response);
    }

    private void handleTesters(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> testers = new ArrayList<>();

        // Get testers from tier assignments
        Map<String, Set<Long>> testersByGamemode = tierManager.getTesterStats();
        
        for (Map.Entry<String, Set<Long>> entry : testersByGamemode.entrySet()) {
            String gamemode = entry.getKey();
            Set<Long> testerIds = entry.getValue();
            
            for (Long testerId : testerIds) {
                Map<String, Object> testerData = new HashMap<>();
                testerData.put("id", testerId.toString());
                testerData.put("gamemode", gamemode);
                testerData.put("testsCount", tierManager.getTesterTestCount(testerId, gamemode));
                testers.add(testerData);
            }
        }

        response.put("testers", testers);
        response.put("count", testers.size());
        
        sendResponse(exchange, 200, response);
    }

    private void handleStats(HttpExchange exchange) throws IOException {
        if (!"GET".equals(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, Map.of("error", "Method not allowed"));
            return;
        }

        Map<String, Object> response = new HashMap<>();
        Map<String, Map<String, String>> allTiers = tierManager.getAllPlayerTiers();
        
        response.put("totalPlayers", allTiers.size());
        response.put("gamemodes", Arrays.asList("axe-and-shield", "neth-pot", "dia-pot", "smp-kit", "mace", "sword", "uhc", "cpvp"));
        
        Map<String, Integer> tierDistribution = new HashMap<>();
        for (Map<String, String> tiers : allTiers.values()) {
            for (String tier : tiers.values()) {
                tierDistribution.put(tier, tierDistribution.getOrDefault(tier, 0) + 1);
            }
        }
        response.put("tierDistribution", tierDistribution);
        
        sendResponse(exchange, 200, response);
    }

    private int calculateTotalPoints(Map<String, String> tiers) {
        int total = 0;
        for (String tier : tiers.values()) {
            total += TierLeaderboardManager.TIER_POINTS.getOrDefault(tier, 0);
        }
        return total;
    }

    private void sendResponse(HttpExchange exchange, int statusCode, Object data) throws IOException {
        String json = toJson(data);
        byte[] response = json.getBytes(StandardCharsets.UTF_8);
        
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        
        exchange.sendResponseHeaders(statusCode, response.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(response);
        }
    }
    
    private String toJson(Object obj) {
        if (obj instanceof Map) {
            return mapToJson((Map<?, ?>) obj);
        } else if (obj instanceof List) {
            return listToJson((List<?>) obj);
        }
        return "{}";
    }
    
    private String mapToJson(Map<?, ?> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(entry.getKey()).append("\":");
            sb.append(valueToJson(entry.getValue()));
        }
        sb.append("}");
        return sb.toString();
    }
    
    private String listToJson(List<?> list) {
        StringBuilder sb = new StringBuilder("[");
        boolean first = true;
        for (Object item : list) {
            if (!first) sb.append(",");
            first = false;
            sb.append(valueToJson(item));
        }
        sb.append("]");
        return sb.toString();
    }
    
    private String valueToJson(Object value) {
        if (value == null) return "null";
        if (value instanceof String) return "\""+value.toString().replace("\"", "\\\"")+"\"";
        if (value instanceof Number) return value.toString();
        if (value instanceof Boolean) return value.toString();
        if (value instanceof Map) return mapToJson((Map<?, ?>) value);
        if (value instanceof List) return listToJson((List<?>) value);
        return "\""+value.toString().replace("\"", "\\\"")+"\"";
    }
}
