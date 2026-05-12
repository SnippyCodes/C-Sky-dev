package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.TierLeaderboardManager;
import java.util.Locale;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.OptionMapping;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.OptionData;
import net.dv8tion.jda.api.interactions.commands.build.SubcommandData;

public final class LeaderboardCommand implements DiscordSlashCommand {

    private final TierLeaderboardManager leaderboardManager;

    public LeaderboardCommand(TierLeaderboardManager leaderboardManager) {
        this.leaderboardManager = leaderboardManager;
    }

    @Override
    public String getName() {
        return "leaderboard";
    }

    @Override
    public CommandData getCommandData() {
        OptionData gamemode = new OptionData(OptionType.STRING, "gamemode", "Gamemode to show.", false)
            .addChoice("Axe & Shield", "axe-and-shield")
            .addChoice("Neth Pot", "neth-pot")
            .addChoice("SMP Kit", "smp-kit")
            .addChoice("Mace", "mace")
            .addChoice("Sword", "sword")
            .addChoice("UHC", "uhc")
            .addChoice("CPvP", "cpvp");

        return Commands.slash(getName(), "Leaderboard controls.")
            .setDefaultPermissions(DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR))
            .addSubcommands(
                new SubcommandData("send", "Send a new leaderboard message in the configured leaderboard channel.")
                    .addOptions(gamemode),
                new SubcommandData("refresh", "Refresh (edit) the existing leaderboard message.")
                    .addOptions(gamemode),
                new SubcommandData("reset", "Reset all leaderboard data (WARNING: Cannot be undone!)")
            );
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("⚠️ This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        String sub = event.getSubcommandName();
        String gamemodeKey = resolveGamemodeKey(event);

        if ("send".equalsIgnoreCase(sub)) {
            leaderboardManager.sendNewLeaderboardMessage(gamemodeKey);
            event.reply("✅ Sent leaderboard for **" + leaderboardManager.prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
            return;
        }

        if ("refresh".equalsIgnoreCase(sub)) {
            leaderboardManager.updateLeaderboardMessage(gamemodeKey);
            event.reply("🔄 Refreshed leaderboard for **" + leaderboardManager.prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
            return;
        }

        if ("reset".equalsIgnoreCase(sub)) {
            leaderboardManager.resetLeaderboard();
            event.reply("⚠️ ✅ Leaderboard has been reset! All tier data deleted.").setEphemeral(true).queue();
            return;
        }

        event.reply("Unknown leaderboard subcommand.").setEphemeral(true).queue();
    }

    private String resolveGamemodeKey(SlashCommandInteractionEvent event) {
        OptionMapping gmOpt = event.getOption("gamemode");
        if (gmOpt == null) {
            return "axe-and-shield";
        }
        return gmOpt.getAsString().trim().toLowerCase(Locale.ROOT);
    }
}

