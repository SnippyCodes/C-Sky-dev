package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import java.io.File;
import java.io.IOException;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

public final class RestrictionManager {

    private final DiscordQueuePlugin plugin;
    private final File restrictedFile;
    private final Set<Long> restrictedUsers = ConcurrentHashMap.newKeySet();

    public RestrictionManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        this.restrictedFile = new File(plugin.getDataFolder(), "restricted-users.yml");
        load();
    }

    public boolean isRestricted(long userId) {
        return restrictedUsers.contains(userId);
    }

    public boolean restrict(long userId) {
        boolean added = restrictedUsers.add(userId);
        if (added) {
            save();
        }
        return added;
    }

    public boolean unrestrict(long userId) {
        boolean removed = restrictedUsers.remove(userId);
        if (removed) {
            save();
        }
        return removed;
    }

    public Set<Long> getRestrictedUsers() {
        return Collections.unmodifiableSet(restrictedUsers);
    }

    private void load() {
        if (!restrictedFile.exists()) {
            return;
        }

        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(restrictedFile);
        ConfigurationSection section = yaml.getConfigurationSection("restricted");
        if (section == null) return;

        for (String key : section.getKeys(false)) {
            try {
                long userId = Long.parseLong(key);
                if (section.getBoolean(key, false)) {
                    restrictedUsers.add(userId);
                }
            } catch (NumberFormatException ignored) {
            }
        }
    }

    private void save() {
        YamlConfiguration yaml = new YamlConfiguration();
        for (Long userId : restrictedUsers) {
            yaml.set("restricted." + userId, true);
        }

        try {
            yaml.save(restrictedFile);
        } catch (IOException exception) {
            plugin.getLogger().warning("Failed to save restricted-users.yml: " + exception.getMessage());
        }
    }
}

