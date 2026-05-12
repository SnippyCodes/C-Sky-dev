package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

public final class LuckPermsManager {

    private final DiscordQueuePlugin plugin;
    private LuckPerms luckPerms;
    private boolean enabled = false;

    public LuckPermsManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        if (plugin.getConfig().getBoolean("luckperms-enabled", true)) {
            initializeLuckPerms();
        } else {
            plugin.getLogger().info("LuckPerms integration disabled in config.");
        }
    }

    private void initializeLuckPerms() {
        if (Bukkit.getPluginManager().getPlugin("LuckPerms") == null) {
            plugin.getLogger().warning("LuckPerms not found! Minecraft tier sync disabled.");
            return;
        }

        try {
            luckPerms = LuckPermsProvider.get();
            enabled = true;
            plugin.getLogger().info("LuckPerms integration enabled!");
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to hook into LuckPerms: " + e.getMessage());
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Assigns a LuckPerms group to a player based on their tier
     * @param minecraftUsername The player's Minecraft username
     * @param gamemode The gamemode key (e.g., "axe-and-shield")
     * @param tier The tier code (e.g., "HT1", "LT5")
     */
    public void assignTierGroup(String minecraftUsername, String gamemode, String tier) {
        if (!enabled) return;

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(minecraftUsername);
                UUID uuid = offlinePlayer.getUniqueId();

                if (uuid == null) {
                    plugin.getLogger().warning("Could not find UUID for player: " + minecraftUsername);
                    return;
                }

                // Load user
                CompletableFuture<User> userFuture = luckPerms.getUserManager().loadUser(uuid);
                userFuture.thenAcceptAsync(user -> {
                    if (user == null) {
                        plugin.getLogger().warning("Could not load LuckPerms user for: " + minecraftUsername);
                        return;
                    }

                    // Remove old tier groups for this gamemode
                    removeOldTierGroups(user, gamemode);

                    // Add new tier group
                    String groupName = buildGroupName(gamemode, tier);
                    Node node = Node.builder("group." + groupName).build();
                    user.data().add(node);

                    // Save user
                    luckPerms.getUserManager().saveUser(user);
                    plugin.getLogger().info("Assigned LuckPerms group '" + groupName + "' to " + minecraftUsername);
                    
                    // Update nametag
                    plugin.getPlayerTierManager().updateNametag(minecraftUsername);
                }).exceptionally(throwable -> {
                    plugin.getLogger().warning("Error assigning tier group: " + throwable.getMessage());
                    return null;
                });

            } catch (Exception e) {
                plugin.getLogger().warning("Error in assignTierGroup: " + e.getMessage());
            }
        });
    }

    /**
     * Removes all tier groups for a specific gamemode from a user
     */
    private void removeOldTierGroups(User user, String gamemode) {
        String gamemodePrefix = normalizeGamemode(gamemode) + "-";
        
        user.getNodes().stream()
            .filter(node -> node.getKey().startsWith("group." + gamemodePrefix))
            .forEach(node -> user.data().remove(node));
    }

    /**
     * Builds the LuckPerms group name from gamemode and tier
     * Example: "axe-and-shield" + "HT1" -> "axe-ht1"
     */
    private String buildGroupName(String gamemode, String tier) {
        String normalizedGamemode = normalizeGamemode(gamemode);
        String normalizedTier = tier.toLowerCase().replace(" ", "-");
        return normalizedGamemode + "-" + normalizedTier;
    }

    /**
     * Normalizes gamemode key for group naming
     * Example: "axe-and-shield" -> "axe"
     */
    private String normalizeGamemode(String gamemode) {
        return switch (gamemode.toLowerCase()) {
            case "axe-and-shield" -> "axe";
            case "neth-pot" -> "neth";
            case "dia-pot" -> "dia";
            case "smp-kit" -> "smp";
            case "mace" -> "mace";
            case "sword" -> "sword";
            case "uhc" -> "uhc";
            case "cpvp" -> "cpvp";
            default -> gamemode.toLowerCase().replaceAll("[^a-z0-9]", "");
        };
    }
}
