package com.example.discordqueuebot.command;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.manager.PlayerTierManager;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class TierSetCommand implements CommandExecutor, TabCompleter {

    private final DiscordQueuePlugin plugin;
    private final PlayerTierManager tierManager;

    public TierSetCommand(DiscordQueuePlugin plugin, PlayerTierManager tierManager) {
        this.plugin = plugin;
        this.tierManager = tierManager;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(ChatColor.RED + "Only players can use this command.");
            return true;
        }

        if (args.length == 0) {
            sender.sendMessage(ChatColor.RED + "Usage: /tier set <gamemode>");
            sender.sendMessage(ChatColor.GRAY + "Available: axe, nethpot, smp, mace, sword, uhc, cpvp");
            return true;
        }

        if (!args[0].equalsIgnoreCase("set")) {
            sender.sendMessage(ChatColor.RED + "Usage: /tier set <gamemode>");
            return true;
        }

        if (args.length < 2) {
            sender.sendMessage(ChatColor.RED + "Please specify a gamemode!");
            sender.sendMessage(ChatColor.GRAY + "Available: axe, nethpot, smp, mace, sword, uhc, cpvp");
            return true;
        }

        String gamemode = args[1];
        String playerName = player.getName();

        // Check if player has tier in this gamemode
        Map<String, String> tiers = tierManager.getPlayerTiers(playerName);
        
        if (tiers.isEmpty()) {
            player.sendMessage(ChatColor.RED + "❌ You don't have any tiers yet!");
            return true;
        }

        boolean success = tierManager.setSelectedTier(playerName, gamemode);

        if (success) {
            String normalizedGamemode = normalizeGamemode(gamemode);
            String tier = tiers.get(normalizedGamemode);
            player.sendMessage(ChatColor.GREEN + "✅ Nametag updated to show: " + 
                             ChatColor.YELLOW + formatGamemode(normalizedGamemode) + "-" + tier);
        } else {
            player.sendMessage(ChatColor.RED + "❌ You don't have a tier in " + 
                             ChatColor.YELLOW + formatGamemode(gamemode) + ChatColor.RED + " gamemode!");
            player.sendMessage(ChatColor.GRAY + "Your tiers: " + String.join(", ", tiers.keySet()));
        }

        return true;
    }

    @Override
    public List<String> onTabComplete(CommandSender sender, Command command, String alias, String[] args) {
        List<String> completions = new ArrayList<>();

        if (args.length == 1) {
            completions.add("set");
        } else if (args.length == 2 && args[0].equalsIgnoreCase("set")) {
            if (sender instanceof Player player) {
                Map<String, String> tiers = tierManager.getPlayerTiers(player.getName());
                completions.addAll(tiers.keySet());
            }
        }

        return completions;
    }

    private String normalizeGamemode(String gamemode) {
        return switch (gamemode.toLowerCase()) {
            case "axe", "axe-and-shield" -> "axe";
            case "neth", "nethpot", "neth-pot" -> "nethpot";
            case "smp", "smp-kit" -> "smp";
            case "mace" -> "mace";
            case "sword" -> "sword";
            case "uhc" -> "uhc";
            case "cpvp" -> "cpvp";
            default -> gamemode.toLowerCase();
        };
    }

    private String formatGamemode(String gamemode) {
        return switch (gamemode.toLowerCase()) {
            case "axe" -> "Axe";
            case "nethpot" -> "Neth";
            case "smp" -> "SMP";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> gamemode.substring(0, 1).toUpperCase() + gamemode.substring(1);
        };
    }
}
