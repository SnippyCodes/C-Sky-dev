package com.example.discordqueuebot.command;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.manager.TierLeaderboardManager;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import net.luckperms.api.model.group.Group;
import net.luckperms.api.node.Node;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;

import java.util.ArrayList;
import java.util.List;

public final class GenerateLuckPermsGroupsCommand implements CommandExecutor {

    private final DiscordQueuePlugin plugin;

    private static final String[][] GAMEMODES = {
        {"axe-and-shield", "axe", "Axe", "&a"},      // Green
        {"neth-pot", "neth", "Neth", "&c"},          // Red
        {"dia-pot", "dia", "Dia", "&d"},             // Pink
        {"smp-kit", "smp", "SMP", "&6"},             // Orange
        {"mace", "mace", "Mace", "&7"},              // Gray
        {"sword", "sword", "Sword", "&b"},           // Blue
        {"uhc", "uhc", "UHC", "&e"},                 // Yellow
        {"cpvp", "cpvp", "CPvP", "&5"}               // Purple
    };

    public GenerateLuckPermsGroupsCommand(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!sender.hasPermission("primetiers.admin")) {
            sender.sendMessage(ChatColor.RED + "You don't have permission to use this command.");
            return true;
        }

        if (args.length == 0) {
            sender.sendMessage(ChatColor.RED + "Usage: /roles generate | /roles update");
            return true;
        }

        if (args[0].equalsIgnoreCase("generate")) {
            generateGroups(sender);
            return true;
        }

        if (args[0].equalsIgnoreCase("update")) {
            updateExistingGroups(sender);
            return true;
        }

        sender.sendMessage(ChatColor.RED + "Usage: /roles generate | /roles update");
        return true;
    }

    private void generateGroups(CommandSender sender) {
        if (!plugin.getLuckPermsManager().isEnabled()) {
            sender.sendMessage(ChatColor.RED + "❌ LuckPerms is not enabled!");
            return;
        }

        sender.sendMessage(ChatColor.YELLOW + "⏳ Generating LuckPerms groups with colored prefixes...");

        try {
            LuckPerms luckPerms = LuckPermsProvider.get();
            int created = 0;
            int skipped = 0;

            for (String[] gm : GAMEMODES) {
                String shortName = gm[1];      // axe, nethpot, etc.
                String displayName = gm[2];    // Axe, NethPot, etc.
                String color = gm[3];          // &a, &c, etc.
                
                for (String tier : TierLeaderboardManager.TIER_ORDER) {
                    String groupName = shortName + "-" + tier.toLowerCase();
                    
                    // Check if group already exists
                    Group existingGroup = luckPerms.getGroupManager().getGroup(groupName);
                    if (existingGroup != null) {
                        skipped++;
                        continue;
                    }

                    // Create group
                    luckPerms.getGroupManager().createAndLoadGroup(groupName).thenAccept(group -> {
                        if (group != null) {
                            // Set colored prefix: [Axe-HT1] with &f for name
                            String prefix = color + "[" + displayName + "-" + tier.toUpperCase() + "] &f";
                            Node prefixNode = Node.builder("prefix.100." + prefix).build();
                            group.data().add(prefixNode);
                            
                            // Save group
                            luckPerms.getGroupManager().saveGroup(group);
                        }
                    }).join(); // Wait for completion
                    
                    created++;
                }
            }

            sender.sendMessage(ChatColor.GREEN + "✅ Done!");
            sender.sendMessage(ChatColor.YELLOW + "Created: " + ChatColor.WHITE + created + " groups with colored prefixes");
            if (skipped > 0) {
                sender.sendMessage(ChatColor.GRAY + "Skipped (already exist): " + skipped + " groups");
            }
            sender.sendMessage(ChatColor.AQUA + "Total: " + (created + skipped) + "/80 groups");
            sender.sendMessage(ChatColor.GREEN + "Example: " + ChatColor.translateAlternateColorCodes('&', "&a[Axe-HT1] &fPlayerName"));

        } catch (Exception e) {
            sender.sendMessage(ChatColor.RED + "❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void updateExistingGroups(CommandSender sender) {
        if (!plugin.getLuckPermsManager().isEnabled()) {
            sender.sendMessage(ChatColor.RED + "❌ LuckPerms is not enabled!");
            return;
        }

        sender.sendMessage(ChatColor.YELLOW + "⏳ Updating existing LuckPerms groups with new prefixes...");

        try {
            LuckPerms luckPerms = LuckPermsProvider.get();
            int updated = 0;
            int notFound = 0;

            for (String[] gm : GAMEMODES) {
                String shortName = gm[1];      // axe, neth, dia, etc.
                String displayName = gm[2];    // Axe, Neth, Dia, etc.
                String color = gm[3];          // &a, &c, &d, etc.
                
                for (String tier : TierLeaderboardManager.TIER_ORDER) {
                    String groupName = shortName + "-" + tier.toLowerCase();
                    
                    // Check if group exists
                    Group existingGroup = luckPerms.getGroupManager().getGroup(groupName);
                    if (existingGroup == null) {
                        notFound++;
                        continue;
                    }

                    // Clear old prefix nodes
                    existingGroup.data().clear(node -> node.getKey().startsWith("prefix."));
                    
                    // Set new colored prefix with &f for name
                    String prefix = color + "[" + displayName + "-" + tier.toUpperCase() + "] &f";
                    Node prefixNode = Node.builder("prefix.100." + prefix).build();
                    existingGroup.data().add(prefixNode);
                    
                    // Save group
                    luckPerms.getGroupManager().saveGroup(existingGroup);
                    updated++;
                }
            }

            sender.sendMessage(ChatColor.GREEN + "✅ Done!");
            sender.sendMessage(ChatColor.YELLOW + "Updated: " + ChatColor.WHITE + updated + " groups");
            if (notFound > 0) {
                sender.sendMessage(ChatColor.GRAY + "Not found: " + notFound + " groups (use /roles generate to create them)");
            }
            sender.sendMessage(ChatColor.GREEN + "Example: " + ChatColor.translateAlternateColorCodes('&', "&a[Axe-HT1] &fPlayerName"));

        } catch (Exception e) {
            sender.sendMessage(ChatColor.RED + "❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
