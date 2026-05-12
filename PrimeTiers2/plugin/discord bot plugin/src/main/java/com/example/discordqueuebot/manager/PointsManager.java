package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import java.io.File;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.bukkit.configuration.file.YamlConfiguration;

public final class PointsManager {

    private final DiscordQueuePlugin plugin;
    private final File dataFile;
    // mcName (lowercase) -> points
    private final Map<String, Integer> points = new ConcurrentHashMap<>();

    public PointsManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        this.dataFile = new File(plugin.getDataFolder(), "points.yml");
        load();
    }

    public int add(String mcName, int amount) {
        int val = points.merge(mcName.toLowerCase(), amount, Integer::sum);
        save();
        return val;
    }

    public int remove(String mcName, int amount) {
        int val = points.merge(mcName.toLowerCase(), -amount, Integer::sum);
        save();
        return val;
    }

    public int set(String mcName, int amount) {
        points.put(mcName.toLowerCase(), amount);
        save();
        return amount;
    }

    public int get(String mcName) {
        return points.getOrDefault(mcName.toLowerCase(), 0);
    }

    private void load() {
        if (!dataFile.exists()) return;
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(dataFile);
        for (String key : yaml.getKeys(false)) {
            points.put(key, yaml.getInt(key, 0));
        }
    }

    private void save() {
        YamlConfiguration yaml = new YamlConfiguration();
        points.forEach(yaml::set);
        try {
            yaml.save(dataFile);
        } catch (IOException e) {
            plugin.getLogger().warning("Failed to save points.yml: " + e.getMessage());
        }
    }
}
