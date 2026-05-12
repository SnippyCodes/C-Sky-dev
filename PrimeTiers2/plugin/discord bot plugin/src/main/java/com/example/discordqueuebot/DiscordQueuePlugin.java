package com.example.discordqueuebot;

import com.example.discordqueuebot.api.WebAPIServer;
import com.example.discordqueuebot.bot.BotManager;
import com.example.discordqueuebot.command.GenerateLuckPermsGroupsCommand;
import com.example.discordqueuebot.command.ProfileCommand;
import com.example.discordqueuebot.command.TierSetCommand;
import com.example.discordqueuebot.manager.LuckPermsManager;
import com.example.discordqueuebot.manager.PlayerTierManager;
import com.example.discordqueuebot.manager.RegistrationManager;
import org.bukkit.plugin.java.JavaPlugin;

public final class DiscordQueuePlugin extends JavaPlugin {

    private RegistrationManager registrationManager;
    private LuckPermsManager luckPermsManager;
    private PlayerTierManager playerTierManager;
    private BotManager botManager;
    private WebAPIServer webAPIServer;

    @Override
    public void onEnable() {
        printBanner();
        saveDefaultConfig();

        this.luckPermsManager = new LuckPermsManager(this);
        this.registrationManager = new RegistrationManager(this);
        this.playerTierManager = new PlayerTierManager(this);
        this.botManager = new BotManager(this, registrationManager);

        // Register Minecraft commands
        getCommand("profile").setExecutor(new ProfileCommand(this, playerTierManager, botManager.getTierLeaderboardManager()));
        getCommand("tier").setExecutor(new TierSetCommand(this, playerTierManager));
        getCommand("tier").setTabCompleter(new TierSetCommand(this, playerTierManager));
        getCommand("roles").setExecutor(new GenerateLuckPermsGroupsCommand(this));

        botManager.start();
        
        // Start Web API if enabled
        if (getConfig().getBoolean("api-enabled", true)) {
            webAPIServer = new WebAPIServer(this, botManager.getTierLeaderboardManager());
            webAPIServer.start();
        }
    }

    @Override
    public void onDisable() {
        if (webAPIServer != null) {
            webAPIServer.stop();
        }
        if (botManager != null) {
            botManager.shutdown();
        }
    }

    public RegistrationManager getRegistrationManager() {
        return registrationManager;
    }

    public LuckPermsManager getLuckPermsManager() {
        return luckPermsManager;
    }

    public PlayerTierManager getPlayerTierManager() {
        return playerTierManager;
    }

    public BotManager getBotManager() {
        return botManager;
    }

    private void printBanner() {
        getLogger().info("");
        getLogger().info("  ██████╗ ██████╗ ██╗███╗   ███╗███████╗████████╗██╗███████╗██████╗ ███████╗");
        getLogger().info(" ██╔══██╗██╔══██╗██║████╗ ████║██╔════╝╚══██╔══╝██║██╔════╝██╔══██╗██╔════╝");
        getLogger().info(" ██████╔╝██████╔╝██║██╔████╔██║█████╗     ██║   ██║█████╗  ██████╔╝███████╗");
        getLogger().info(" ██╔═══╝ ██╔══██╗██║██║╚██╔╝██║██╔══╝     ██║   ██║██╔══╝  ██╔══██╗╚════██║");
        getLogger().info(" ██║     ██║  ██║██║██║ ╚═╝ ██║███████╗   ██║   ██║███████╗██║  ██║███████║");
        getLogger().info(" ╚═╝     ╚═╝  ╚═╝╚═╝╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝");
        getLogger().info("");
        getLogger().info("  Version: 2.7.0");
        getLogger().info("  Author: PavitraXD");
        getLogger().info("  Discord Bot - Queue, Testing & Tier Management System");
        getLogger().info("");
    }
}
