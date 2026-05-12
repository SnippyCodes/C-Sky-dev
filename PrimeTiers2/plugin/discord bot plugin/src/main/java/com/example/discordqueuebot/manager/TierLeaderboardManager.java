package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.api.WebhookManager;
import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.components.actionrow.ActionRow;
import net.dv8tion.jda.api.components.buttons.Button;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

public final class TierLeaderboardManager {

    public static final List<String> TIER_ORDER = List.of(
        "HT1", "LT1",
        "HT2", "LT2",
        "HT3", "LT3",
        "HT4", "LT4",
        "HT5", "LT5"
    );

    public static final Map<String, Integer> TIER_POINTS = Map.ofEntries(
        Map.entry("HT1", 60), Map.entry("LT1", 45),
        Map.entry("HT2", 30), Map.entry("LT2", 20),
        Map.entry("HT3", 10), Map.entry("LT3", 6),
        Map.entry("HT4", 4),  Map.entry("LT4", 3),
        Map.entry("HT5", 2),  Map.entry("LT5", 1)
    );

    private static final String OVERALL_KEY = "overall";

    private static final String BUTTON_PREFIX = "lb_gm:";
    private static final String OVERALL_BUTTON_ID = "lb_gm:overall";

    private final DiscordQueuePlugin plugin;
    private final File dataFile;
    private final Map<String, Map<Long, PlayerTier>> tiersByGamemode = new ConcurrentHashMap<>();
    private volatile JDA jda;
    private volatile long leaderboardMessageId;
    private WebhookManager webhookManager;

    public TierLeaderboardManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        this.dataFile = new File(plugin.getDataFolder(), "tier-leaderboard.yml");
        this.webhookManager = new WebhookManager(plugin);
        load();
    }

    public void attachJda(JDA jda) {
        this.jda = jda;
    }

    public void setLeaderboardMessageId(long messageId) {
        this.leaderboardMessageId = messageId;
        save();
    }

    public long getLeaderboardMessageId() {
        return leaderboardMessageId;
    }

    public void upsertTier(long userId, String gamemodeKey, String tier, String ign, long testerId) {
        String normalizedTier = tier == null ? "" : tier.trim().toUpperCase(Locale.ROOT);
        if (!TIER_ORDER.contains(normalizedTier)) return;
        String normalizedGamemode = normalizeGamemodeKey(gamemodeKey);
        tiersByGamemode
            .computeIfAbsent(normalizedGamemode, ignored -> new ConcurrentHashMap<>())
            .put(userId, new PlayerTier(userId, normalizedTier, ign == null ? "" : ign.trim(), testerId, Instant.now().toEpochMilli()));
        save();
        updateLeaderboardMessage(normalizedGamemode);
        
        // Send webhook notification
        int points = TIER_POINTS.getOrDefault(normalizedTier, 0);
        // Fetch skin URL from registration profile if available
        String skinUrl = "";
        try {
            com.example.discordqueuebot.manager.RegistrationManager regMgr = plugin.getRegistrationManager();
            if (regMgr != null) {
                com.example.discordqueuebot.model.RegistrationProfile profile = regMgr.getProfile(userId);
                if (profile != null && profile.skinUrl() != null && !profile.skinUrl().isBlank()) {
                    skinUrl = profile.skinUrl();
                }
            }
        } catch (Exception ignored) {}
        webhookManager.sendTierUpdate(ign, normalizedGamemode, normalizedTier, points, skinUrl);
    }

    public String getPreviousTier(long userId, String gamemodeKey) {
        Map<Long, PlayerTier> map = tiersByGamemode.get(normalizeGamemodeKey(gamemodeKey));
        if (map == null) return null;
        PlayerTier pt = map.get(userId);
        return pt != null ? pt.tier : null;
    }

    public void removeTier(long userId, String gamemodeKey) {
        String normalizedGamemode = normalizeGamemodeKey(gamemodeKey);
        Map<Long, PlayerTier> map = tiersByGamemode.get(normalizedGamemode);
        if (map == null) return;
        PlayerTier removed = map.remove(userId);
        save();
        updateLeaderboardMessage(normalizedGamemode);
        
        // Send webhook notification
        if (removed != null) {
            webhookManager.sendTierRemoval(removed.ign, normalizedGamemode);
        }
    }

    public void updateLeaderboardMessage(String gamemodeKey) {
        if (jda == null) return;
        long channelId = plugin.getConfig().getLong("leaderboard-channel-id", 0L);
        if (channelId <= 0L) return;

        TextChannel resolvedChannel = null;
        for (Guild guild : jda.getGuilds()) {
            TextChannel candidate = guild.getTextChannelById(channelId);
            if (candidate != null) {
                resolvedChannel = candidate;
                break;
            }
        }
        if (resolvedChannel == null) return;
        final TextChannel channel = resolvedChannel;

        String normalized = normalizeGamemodeKey(gamemodeKey);
        MessageEmbed embed = buildLeaderboardEmbed(normalized, channel.getJDA());
        List<ActionRow> rows = buildGamemodeButtons(normalized);

        if (leaderboardMessageId != 0L) {
            channel.editMessageEmbedsById(leaderboardMessageId, embed)
                .setComponents(rows)
                .queue(
                    success -> {
                    },
                    error -> createLeaderboardMessage(channel, embed, rows)
                );
            return;
        }

        channel.getHistory().retrievePast(10).queue(messages -> {
            messages.stream()
                .filter(m -> m.getAuthor().getIdLong() == channel.getJDA().getSelfUser().getIdLong())
                .findFirst()
                .ifPresentOrElse(m -> {
                    leaderboardMessageId = m.getIdLong();
                    save();
                    channel.editMessageEmbedsById(leaderboardMessageId, embed).setComponents(rows).queue();
                }, () -> createLeaderboardMessage(channel, embed, rows));
        }, error -> createLeaderboardMessage(channel, embed, rows));
    }

    public void sendNewLeaderboardMessage(String gamemodeKey) {
        if (jda == null) {
            return;
        }
        long channelId = plugin.getConfig().getLong("leaderboard-channel-id", 0L);
        if (channelId <= 0L) {
            return;
        }

        TextChannel resolvedChannel = null;
        for (Guild guild : jda.getGuilds()) {
            TextChannel candidate = guild.getTextChannelById(channelId);
            if (candidate != null) {
                resolvedChannel = candidate;
                break;
            }
        }
        if (resolvedChannel == null) {
            return;
        }

        String normalized = normalizeGamemodeKey(gamemodeKey);
        MessageEmbed embed = buildLeaderboardEmbed(normalized, resolvedChannel.getJDA());
        List<ActionRow> rows = buildGamemodeButtons(normalized);
        resolvedChannel.sendMessageEmbeds(embed).setComponents(rows).queue(m -> {
            leaderboardMessageId = m.getIdLong();
            save();
        });
    }

    /**
     * Reset all leaderboard data
     */
    public void resetLeaderboard() {
        tiersByGamemode.clear();
        leaderboardMessageId = 0L;
        save();
        plugin.getLogger().info("Leaderboard has been reset!");
        
        // Send webhook notification
        webhookManager.sendLeaderboardReset();
    }

    public boolean handleGamemodeButton(String componentId, ConsumerReply reply) {
        if (componentId == null || !componentId.startsWith(BUTTON_PREFIX)) {
            return false;
        }
        String key = componentId.substring(BUTTON_PREFIX.length());
        updateLeaderboardMessage(key);
        reply.replyEphemeral("🏆 Showing leaderboard for **" + prettyGamemode(key) + "**.");
        return true;
    }

    private void createLeaderboardMessage(TextChannel channel, MessageEmbed embed, List<ActionRow> rows) {
        channel.sendMessageEmbeds(embed).setComponents(rows).queue(m -> {
            leaderboardMessageId = m.getIdLong();
            save();
        });
    }

    private MessageEmbed buildLeaderboardEmbed(String gamemodeKey, JDA jda) {
        String pretty = prettyGamemode(gamemodeKey);
        StringBuilder description = new StringBuilder();

        if (OVERALL_KEY.equals(gamemodeKey)) {
            // Aggregate points across all gamemodes
            Map<Long, long[]> totals = new LinkedHashMap<>(); // userId -> [totalPoints, lastIgnHolder]
            Map<Long, String> ignMap = new LinkedHashMap<>();
            for (Map<Long, PlayerTier> map : tiersByGamemode.values()) {
                for (PlayerTier pt : map.values()) {
                    int pts = TIER_POINTS.getOrDefault(pt.tier, 0);
                    totals.computeIfAbsent(pt.userId, k -> new long[]{0})[0] += pts;
                    if (pt.ign != null && !pt.ign.isBlank()) ignMap.put(pt.userId, pt.ign);
                }
            }
            if (totals.isEmpty()) {
                description.append("No player tiers recorded yet.");
            } else {
                List<Map.Entry<Long, long[]>> sorted = new ArrayList<>(totals.entrySet());
                sorted.sort((a, b) -> Long.compare(b.getValue()[0], a.getValue()[0]));
                int rank = 1;
                for (Map.Entry<Long, long[]> e : sorted.stream().limit(25).toList()) {
                    long uid = e.getKey();
                    long pts = e.getValue()[0];
                    String name = ignMap.containsKey(uid) ? ignMap.get(uid)
                        : (jda.getUserById(uid) != null ? jda.getUserById(uid).getName() : "<@" + uid + ">");
                    String title = achievementTitle((int) pts);
                    description.append(rank++).append(". **").append(name).append("** — ")
                        .append(pts).append(" pts (").append(title).append(")\n");
                }
            }
            return new EmbedBuilder()
                .setTitle("🏆 PrimeTiers Overall Leaderboard")
                .setColor(new Color(255, 215, 0))
                .setTimestamp(Instant.now())
                .addField("🌐 Scope", "All Gamemodes", false)
                .setDescription(description.toString())
                .setFooter("PrimeTiers 🔥")
                .build();
        }

        Map<Long, PlayerTier> map = tiersByGamemode.getOrDefault(gamemodeKey, Map.of());
        if (map.isEmpty()) {
            description.append("No player tiers recorded yet for this gamemode.");
        } else {
            List<PlayerTier> sorted = new ArrayList<>(map.values());
            sorted.sort(Comparator
                .comparingInt((PlayerTier pt) -> tierIndex(pt.tier))
                .thenComparingLong(pt -> pt.updatedAtMillis));

            int rank = 1;
            for (PlayerTier pt : sorted.stream().limit(25).toList()) {
                User user = jda.getUserById(pt.userId);
                String name = pt.ign != null && !pt.ign.isBlank()
                    ? pt.ign
                    : (user != null ? user.getName() : ("<@" + pt.userId + ">"));
                int pts = TIER_POINTS.getOrDefault(pt.tier, 0);
                description.append(rank++).append(". ")
                    .append("**").append(name).append("** — ").append(pt.tier)
                    .append(" (").append(pts).append(" pts)")
                    .append("\n");
            }
        }

        return new EmbedBuilder()
            .setTitle("🏆 PrimeTiers Leaderboard")
            .setColor(new Color(88, 101, 242))
            .setTimestamp(Instant.now())
            .addField("🎮 Gamemode", pretty, false)
            .setDescription(description.toString())
            .setFooter("PrimeTiers 🔥")
            .build();
    }

    private String achievementTitle(int pts) {
        if (pts >= 400) return "Combat Grandmaster";
        if (pts >= 250) return "Combat Master";
        if (pts >= 100) return "Combat Ace";
        if (pts >= 50)  return "Combat Specialist";
        if (pts >= 20)  return "Combat Cadet";
        if (pts >= 10)  return "Combat Novice";
        return "Rookie";
    }

    private List<ActionRow> buildGamemodeButtons(String activeKey) {
        List<String> keys = List.of(
            "axe-and-shield",
            "neth-pot",
            "smp-kit",
            "mace",
            "sword",
            "uhc",
            "cpvp"
        );

        List<Button> buttons = new ArrayList<>();
        for (String key : keys) {
            Button b = Button.secondary(BUTTON_PREFIX + key, shortGamemodeLabel(key));
            if (key.equals(activeKey)) b = b.asDisabled();
            buttons.add(b);
        }
        // Overall button
        Button overall = Button.primary(OVERALL_BUTTON_ID, "Overall");
        if (OVERALL_KEY.equals(activeKey)) overall = overall.asDisabled();
        buttons.add(overall);

        List<ActionRow> rows = new ArrayList<>();
        rows.add(ActionRow.of(buttons.subList(0, Math.min(5, buttons.size()))));
        if (buttons.size() > 5) {
            rows.add(ActionRow.of(buttons.subList(5, buttons.size())));
        }
        return rows;
    }

    private int tierIndex(String tier) {
        int idx = TIER_ORDER.indexOf(tier);
        return idx < 0 ? Integer.MAX_VALUE : idx;
    }

    private String normalizeGamemodeKey(String gamemodeKey) {
        return gamemodeKey == null ? "" : gamemodeKey.trim().toLowerCase(Locale.ROOT);
    }

    private String shortGamemodeLabel(String key) {
        return switch (key) {
            case "axe-and-shield" -> "Axe";
            case "neth-pot" -> "NethPot";
            case "smp-kit" -> "SMP";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> key;
        };
    }

    public String prettyGamemode(String key) {
        return switch (key) {
            case "axe-and-shield" -> "Axe & Shield";
            case "neth-pot" -> "Neth Pot";
            case "smp-kit" -> "SMP Kit";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            case "overall" -> "Overall";
            default -> key;
        };
    }

    private void load() {
        if (!dataFile.exists()) {
            return;
        }
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(dataFile);
        this.leaderboardMessageId = yaml.getLong("leaderboard-message-id", 0L);

        ConfigurationSection gms = yaml.getConfigurationSection("gamemodes");
        if (gms == null) return;

        for (String gamemodeKey : gms.getKeys(false)) {
            ConfigurationSection section = gms.getConfigurationSection(gamemodeKey);
            if (section == null) continue;
            Map<Long, PlayerTier> map = new ConcurrentHashMap<>();
            for (String userKey : section.getKeys(false)) {
                ConfigurationSection entry = section.getConfigurationSection(userKey);
                if (entry == null) continue;
                try {
                    long userId = Long.parseLong(userKey);
                    String tier = entry.getString("tier", "").trim().toUpperCase(Locale.ROOT);
                    String ign = entry.getString("ign", "").trim();
                    long testerId = entry.getLong("tester-id", 0L);
                    long updatedAt = entry.getLong("updated-at", 0L);
                    if (!TIER_ORDER.contains(tier)) continue;
                    map.put(userId, new PlayerTier(userId, tier, ign, testerId, updatedAt));
                } catch (NumberFormatException ignored) {
                }
            }
            tiersByGamemode.put(gamemodeKey, map);
        }
    }

    private void save() {
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.set("leaderboard-message-id", leaderboardMessageId);
        for (Map.Entry<String, Map<Long, PlayerTier>> gm : tiersByGamemode.entrySet()) {
            String gmPath = "gamemodes." + gm.getKey();
            for (PlayerTier pt : gm.getValue().values()) {
                String path = gmPath + "." + pt.userId;
                yaml.set(path + ".tier", pt.tier);
                yaml.set(path + ".ign", pt.ign);
                yaml.set(path + ".tester-id", pt.testerId);
                yaml.set(path + ".updated-at", pt.updatedAtMillis);
            }
        }

        try {
            yaml.save(dataFile);
        } catch (IOException exception) {
            plugin.getLogger().warning("Failed to save tier-leaderboard.yml: " + exception.getMessage());
        }
    }

    /**
     * Get all player tiers for API
     */
    public Map<String, Map<String, String>> getAllPlayerTiers() {
        Map<String, Map<String, String>> result = new LinkedHashMap<>();
        
        for (Map.Entry<String, Map<Long, PlayerTier>> gmEntry : tiersByGamemode.entrySet()) {
            String gamemode = gmEntry.getKey();
            for (PlayerTier pt : gmEntry.getValue().values()) {
                result.computeIfAbsent(pt.ign, k -> new LinkedHashMap<>()).put(gamemode, pt.tier);
            }
        }
        
        return result;
    }

    /**
     * Get leaderboard for specific gamemode
     */
    public Map<String, String> getLeaderboard(String gamemodeKey) {
        String normalized = normalizeGamemodeKey(gamemodeKey);
        Map<Long, PlayerTier> map = tiersByGamemode.getOrDefault(normalized, Map.of());
        
        Map<String, String> result = new LinkedHashMap<>();
        List<PlayerTier> sorted = new ArrayList<>(map.values());
        sorted.sort(Comparator
            .comparingInt((PlayerTier pt) -> tierIndex(pt.tier))
            .thenComparingLong(pt -> pt.updatedAtMillis));
        
        for (PlayerTier pt : sorted) {
            result.put(pt.ign, pt.tier);
        }
        
        return result;
    }

    /**
     * Get overall leaderboard with total points
     */
    public Map<String, Integer> getOverallLeaderboard() {
        Map<String, Integer> totals = new LinkedHashMap<>();
        
        for (Map<Long, PlayerTier> map : tiersByGamemode.values()) {
            for (PlayerTier pt : map.values()) {
                int pts = TIER_POINTS.getOrDefault(pt.tier, 0);
                totals.put(pt.ign, totals.getOrDefault(pt.ign, 0) + pts);
            }
        }
        
        // Sort by points descending
        return totals.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
            .collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue()), Map::putAll);
    }

    /**
     * Get tester statistics
     */
    public Map<String, Set<Long>> getTesterStats() {
        Map<String, Set<Long>> stats = new LinkedHashMap<>();
        
        for (Map.Entry<String, Map<Long, PlayerTier>> gmEntry : tiersByGamemode.entrySet()) {
            String gamemode = gmEntry.getKey();
            Set<Long> testers = new java.util.HashSet<>();
            
            for (PlayerTier pt : gmEntry.getValue().values()) {
                if (pt.testerId > 0) {
                    testers.add(pt.testerId);
                }
            }
            
            stats.put(gamemode, testers);
        }
        
        return stats;
    }

    /**
     * Get test count for a specific tester in a gamemode
     */
    public int getTesterTestCount(long testerId, String gamemodeKey) {
        String normalized = normalizeGamemodeKey(gamemodeKey);
        Map<Long, PlayerTier> map = tiersByGamemode.get(normalized);
        if (map == null) return 0;
        
        return (int) map.values().stream()
            .filter(pt -> pt.testerId == testerId)
            .count();
    }

    private record PlayerTier(long userId, String tier, String ign, long testerId, long updatedAtMillis) {
    }

    public interface ConsumerReply {
        void replyEphemeral(String message);
    }
}
