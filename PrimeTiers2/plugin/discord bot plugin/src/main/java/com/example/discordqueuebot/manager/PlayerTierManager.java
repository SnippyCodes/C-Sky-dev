package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.user.User;
import net.luckperms.api.node.Node;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.*;

public final class PlayerTierManager {

    private final DiscordQueuePlugin plugin;
    private File selectedTiersFile;
    private FileConfiguration selectedTiersConfig;

    public PlayerTierManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        loadSelectedTiers();
    }

    private void loadSelectedTiers() {
        selectedTiersFile = new File(plugin.getDataFolder(), "selected-tiers.yml");
        if (!selectedTiersFile.exists()) {
            try {
                selectedTiersFile.createNewFile();
            } catch (IOException e) {
                plugin.getLogger().warning("Could not create selected-tiers.yml: " + e.getMessage());
            }
        }
        selectedTiersConfig = YamlConfiguration.loadConfiguration(selectedTiersFile);
    }

    private void saveSelectedTiers() {
        try {
            selectedTiersConfig.save(selectedTiersFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Could not save selected-tiers.yml: " + e.getMessage());
        }
    }

    /**
     * Get all tiers for a player from LuckPerms
     * @return Map of gamemode -> tier (e.g., "axe" -> "HT2")
     */
    public Map<String, String> getPlayerTiers(String minecraftUsername) {
        Map<String, String> tiers = new HashMap<>();
        
        if (!plugin.getLuckPermsManager().isEnabled()) {
            return tiers;
        }

        try {
            LuckPerms luckPerms = LuckPermsProvider.get();
            OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(minecraftUsername);
            UUID uuid = offlinePlayer.getUniqueId();

            if (uuid == null) return tiers;

            User user = luckPerms.getUserManager().loadUser(uuid).join();
            if (user == null) return tiers;

            // Extract tier groups
            user.getNodes().stream()
                .filter(node -> node.getKey().startsWith("group."))
                .map(node -> node.getKey().substring(6))
                .filter(group -> group.matches(".*-(ht|lt)\\d+"))
                .forEach(group -> {
                    String[] parts = group.split("-");
                    if (parts.length >= 2) {
                        String gamemode = parts[0];
                        String tier = parts[parts.length - 1].toUpperCase();
                        tiers.put(gamemode, tier);
                    }
                });

        } catch (Exception e) {
            plugin.getLogger().warning("Error getting player tiers: " + e.getMessage());
        }

        return tiers;
    }

    /**
     * Set selected tier for nametag display
     */
    public boolean setSelectedTier(String minecraftUsername, String gamemode) {
        Map<String, String> tiers = getPlayerTiers(minecraftUsername);
        
        String normalizedGamemode = normalizeGamemode(gamemode);
        if (!tiers.containsKey(normalizedGamemode)) {
            return false;
        }

        OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(minecraftUsername);
        selectedTiersConfig.set(offlinePlayer.getUniqueId().toString(), normalizedGamemode);
        saveSelectedTiers();

        // Update nametag
        updateNametag(minecraftUsername);
        return true;
    }

    /**
     * Get selected tier for a player
     */
    public String getSelectedTier(String minecraftUsername) {
        OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(minecraftUsername);
        return selectedTiersConfig.getString(offlinePlayer.getUniqueId().toString());
    }

    /**
     * Update player's nametag with selected tier
     */
    public void updateNametag(String minecraftUsername) {
        if (!plugin.getLuckPermsManager().isEnabled()) return;

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            try {
                LuckPerms luckPerms = LuckPermsProvider.get();
                OfflinePlayer offlinePlayer = Bukkit.getOfflinePlayer(minecraftUsername);
                UUID uuid = offlinePlayer.getUniqueId();

                User user = luckPerms.getUserManager().loadUser(uuid).join();
                if (user == null) return;

                Map<String, String> tiers = getPlayerTiers(minecraftUsername);
                if (tiers.isEmpty()) return;

                String selectedGamemode = getSelectedTier(minecraftUsername);
                String displayGamemode;
                String displayTier;

                if (selectedGamemode != null && tiers.containsKey(selectedGamemode)) {
                    displayGamemode = selectedGamemode;
                    displayTier = tiers.get(selectedGamemode);
                } else {
                    // Default to highest tier
                    Map.Entry<String, String> highest = getHighestTier(tiers);
                    displayGamemode = highest.getKey();
                    displayTier = highest.getValue();
                }

                String prefix = "&6[&e" + formatGamemodeForDisplay(displayGamemode) + "-" + displayTier + "&6] &r";

                // Clear old prefixes and set new one
                user.data().clear(node -> node.getKey().startsWith("prefix."));
                Node prefixNode = Node.builder("prefix.100." + prefix).build();
                user.data().add(prefixNode);

                luckPerms.getUserManager().saveUser(user);
                plugin.getLogger().info("Updated nametag for " + minecraftUsername + ": " + displayGamemode + "-" + displayTier);

            } catch (Exception e) {
                plugin.getLogger().warning("Error updating nametag: " + e.getMessage());
            }
        });
    }

    private Map.Entry<String, String> getHighestTier(Map<String, String> tiers) {
        return tiers.entrySet().stream()
            .min((a, b) -> {
                String tierA = a.getValue();
                String tierB = b.getValue();

                boolean isHTA = tierA.startsWith("HT");
                boolean isHTB = tierB.startsWith("HT");

                if (isHTA && !isHTB) return -1;
                if (!isHTA && isHTB) return 1;

                return tierA.compareTo(tierB);
            })
            .orElse(tiers.entrySet().iterator().next());
    }

    private String normalizeGamemode(String gamemode) {
        return switch (gamemode.toLowerCase()) {
            case "axe", "axe-and-shield" -> "axe";
            case "neth", "nethpot", "neth-pot" -> "neth";
            case "dia", "diapot", "dia-pot" -> "dia";
            case "smp", "smp-kit" -> "smp";
            case "mace" -> "mace";
            case "sword" -> "sword";
            case "uhc" -> "uhc";
            case "cpvp" -> "cpvp";
            default -> gamemode.toLowerCase();
        };
    }

    private String formatGamemodeForDisplay(String gamemode) {
        return switch (gamemode.toLowerCase()) {
            case "axe" -> "Axe";
            case "neth" -> "Neth";
            case "dia" -> "Dia";
            case "smp" -> "SMP";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> gamemode.substring(0, 1).toUpperCase() + gamemode.substring(1);
        };
    }
}
