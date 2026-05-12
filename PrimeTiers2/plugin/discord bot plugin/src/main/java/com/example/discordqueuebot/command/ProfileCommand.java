package com.example.discordqueuebot.command;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.manager.PlayerTierManager;
import com.example.discordqueuebot.manager.TierLeaderboardManager;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.Map;

public final class ProfileCommand implements CommandExecutor {

    private final DiscordQueuePlugin plugin;
    private final PlayerTierManager tierManager;
    private final TierLeaderboardManager leaderboardManager;

    public ProfileCommand(DiscordQueuePlugin plugin, PlayerTierManager tierManager, TierLeaderboardManager leaderboardManager) {
        this.plugin = plugin;
        this.tierManager = tierManager;
        this.leaderboardManager = leaderboardManager;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length == 0) {
            if (!(sender instanceof Player)) {
                sender.sendMessage(ChatColor.RED + "Usage: /profile <minecraft-ign>");
                return true;
            }
            // Show own profile
            showProfile(sender, ((Player) sender).getName());
            return true;
        }

        String targetPlayer = args[0];
        showProfile(sender, targetPlayer);
        return true;
    }

    private void showProfile(CommandSender sender, String minecraftUsername) {
        Map<String, String> tiers = tierManager.getPlayerTiers(minecraftUsername);

        if (tiers.isEmpty()) {
            sender.sendMessage(ChatColor.RED + "❌ This player has not been tested yet.");
            return;
        }

        sender.sendMessage(ChatColor.GOLD + "━━━━━━━━━━━━━━━━━━━━━━━━━━");
        sender.sendMessage(ChatColor.YELLOW + "📊 " + minecraftUsername + "'s Tiers:");
        sender.sendMessage(ChatColor.GOLD + "━━━━━━━━━━━━━━━━━━━━━━━━━━");

        int totalPoints = 0;
        String selectedTier = tierManager.getSelectedTier(minecraftUsername);

        for (Map.Entry<String, String> entry : tiers.entrySet()) {
            String gamemode = entry.getKey();
            String tier = entry.getValue();
            int points = getTierPoints(tier);

            String gamemodeDisplay = formatGamemode(gamemode);
            String isSelected = (gamemode.equals(selectedTier)) ? ChatColor.GREEN + " ✓" : "";

            sender.sendMessage(ChatColor.AQUA + "🎮 " + gamemodeDisplay + ": " + 
                             ChatColor.WHITE + tier + ChatColor.GRAY + " (" + points + " points)" + isSelected);
            totalPoints += points;
        }

        sender.sendMessage(ChatColor.GOLD + "━━━━━━━━━━━━━━━━━━━━━━━━━━");
        sender.sendMessage(ChatColor.YELLOW + "🏆 Total Points: " + ChatColor.WHITE + totalPoints);
        
        if (selectedTier != null) {
            String selectedTierValue = tiers.get(selectedTier);
            sender.sendMessage(ChatColor.YELLOW + "⭐ Selected Tier: " + ChatColor.WHITE + 
                             formatGamemode(selectedTier) + "-" + selectedTierValue);
        }
        
        sender.sendMessage(ChatColor.GOLD + "━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    private String formatGamemode(String gamemode) {
        return switch (gamemode.toLowerCase()) {
            case "axe" -> "Axe & Shield";
            case "nethpot" -> "Neth Pot";
            case "smp" -> "SMP Kit";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> gamemode;
        };
    }

    private String gamemodeKeyFromNormalized(String normalized) {
        return switch (normalized.toLowerCase()) {
            case "axe" -> "axe-and-shield";
            case "nethpot" -> "neth-pot";
            case "smp" -> "smp-kit";
            default -> normalized;
        };
    }

    private int getTierPoints(String tier) {
        return switch (tier.toUpperCase()) {
            case "HT1" -> 500;
            case "LT1" -> 400;
            case "HT2" -> 450;
            case "LT2" -> 350;
            case "HT3" -> 400;
            case "LT3" -> 300;
            case "HT4" -> 350;
            case "LT4" -> 250;
            case "HT5" -> 300;
            case "LT5" -> 150;
            default -> 0;
        };
    }
}
