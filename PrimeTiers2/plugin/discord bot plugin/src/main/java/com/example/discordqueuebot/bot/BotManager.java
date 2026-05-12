package com.example.discordqueuebot.bot;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.command.CloseTicketSlashCommand;
import com.example.discordqueuebot.command.CooldownCommand;
import com.example.discordqueuebot.command.DiscordSlashCommand;
import com.example.discordqueuebot.command.LeaderboardCommand;
import com.example.discordqueuebot.command.PointsCommand;
import com.example.discordqueuebot.command.RestrictCommand;
import com.example.discordqueuebot.command.SendRegisterPanelCommand;
import com.example.discordqueuebot.command.TierCommand;
import com.example.discordqueuebot.command.WaitlistCommand;
import com.example.discordqueuebot.listener.DiscordButtonListener;
import com.example.discordqueuebot.listener.DiscordSlashCommandListener;
import com.example.discordqueuebot.listener.RegistrationListener;
import com.example.discordqueuebot.manager.RegistrationManager;
import com.example.discordqueuebot.manager.RestrictionManager;
import com.example.discordqueuebot.manager.TierLeaderboardManager;
import com.example.discordqueuebot.manager.PointsManager;
import com.example.discordqueuebot.manager.WaitlistQueueManager;
import java.util.concurrent.CompletableFuture;
import java.util.ArrayList;
import java.util.List;
import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.JDABuilder;
import net.dv8tion.jda.api.OnlineStatus;
import net.dv8tion.jda.api.entities.Activity;
import net.dv8tion.jda.api.requests.GatewayIntent;
import net.dv8tion.jda.api.requests.restaction.CommandListUpdateAction;
import net.dv8tion.jda.api.utils.MemberCachePolicy;

public final class BotManager {

    private final DiscordQueuePlugin plugin;
    private final RegistrationManager registrationManager;
    private final WaitlistQueueManager waitlistManager;
    private final TierLeaderboardManager tierLeaderboardManager;
    private final PointsManager pointsManager;
    private final RestrictionManager restrictionManager;
    private CompletableFuture<Void> startupFuture;
    private JDA jda;

    public BotManager(DiscordQueuePlugin plugin, RegistrationManager registrationManager) {
        this.plugin = plugin;
        this.registrationManager = registrationManager;
        this.tierLeaderboardManager = new TierLeaderboardManager(plugin);
        this.restrictionManager = new RestrictionManager(plugin);
        this.waitlistManager = new WaitlistQueueManager(plugin, registrationManager, tierLeaderboardManager, restrictionManager);
        this.pointsManager = new PointsManager(plugin);
    }

    public void start() {
        String token = plugin.getConfig().getString("bot-token", "").trim();
        if (token.isBlank() || "PUT_YOUR_BOT_TOKEN_HERE".equalsIgnoreCase(token)) {
            plugin.getLogger().warning("Discord bot token is missing in config.yml. Bot startup skipped.");
            return;
        }

        List<DiscordSlashCommand> commands = new ArrayList<>();
        commands.add(new SendRegisterPanelCommand(registrationManager));
        commands.add(new WaitlistCommand(waitlistManager));
        commands.add(new TierCommand(tierLeaderboardManager));
        commands.add(new LeaderboardCommand(tierLeaderboardManager));
        commands.add(new PointsCommand(pointsManager));
        commands.add(new CooldownCommand(registrationManager));
        commands.add(new RestrictCommand(restrictionManager));
        commands.add(new CloseTicketSlashCommand(waitlistManager));

        this.startupFuture = CompletableFuture.runAsync(() -> {
            try {
                this.jda = JDABuilder.createDefault(token)
                    .enableIntents(GatewayIntent.GUILD_MEMBERS, GatewayIntent.GUILD_MESSAGES)
                    .setMemberCachePolicy(MemberCachePolicy.ALL)
                    .setStatus(OnlineStatus.ONLINE)
                    .setActivity(Activity.playing("PrimeTiers"))
                    .addEventListeners(
                        new DiscordSlashCommandListener(commands),
                        new DiscordButtonListener(tierLeaderboardManager, waitlistManager),
                        new RegistrationListener(registrationManager)
                    )
                    .build();

                this.jda.awaitReady();
                registerCommands(commands);
                tierLeaderboardManager.attachJda(jda);
                tierLeaderboardManager.updateLeaderboardMessage("axe-and-shield");
                plugin.getLogger().info("Discord bot started successfully as " + jda.getSelfUser().getAsTag() + ".");
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                plugin.getLogger().severe("Interrupted while waiting for Discord bot readiness.");
            } catch (Exception exception) {
                plugin.getLogger().severe("Unexpected Discord startup failure: " + exception.getMessage());
                exception.printStackTrace();
            }
        });
    }

    private void registerCommands(List<DiscordSlashCommand> commands) {
        if (jda == null) {
            return;
        }

        jda.updateCommands().queue(
            success -> plugin.getLogger().info("Cleared global slash commands."),
            error -> plugin.getLogger().warning("Failed to clear global slash commands: " + error.getMessage())
        );

        for (var guild : jda.getGuilds()) {
            CommandListUpdateAction updateAction = guild.updateCommands();
            for (DiscordSlashCommand command : commands) {
                updateAction.addCommands(command.getCommandData());
            }
            updateAction.queue(
                success -> plugin.getLogger().info("Discord slash commands registered for guild " + guild.getName() + "."),
                error -> plugin.getLogger().warning("Failed to register slash commands for guild " + guild.getName() + ": " + error.getMessage())
            );
        }
    }

    public void shutdown() {
        if (jda == null) {
            if (startupFuture != null) {
                startupFuture.cancel(true);
            }
            return;
        }

        jda.shutdownNow();
        jda = null;
        plugin.getLogger().info("Discord bot shut down.");
    }

    public JDA getJda() {
        return jda;
    }

    public TierLeaderboardManager getTierLeaderboardManager() {
        return tierLeaderboardManager;
    }
}
