package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.TierLeaderboardManager;
import java.util.Locale;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.OptionData;
import net.dv8tion.jda.api.interactions.commands.OptionMapping;

public final class TierCommand implements DiscordSlashCommand {

    private final TierLeaderboardManager leaderboardManager;

    public TierCommand(TierLeaderboardManager leaderboardManager) {
        this.leaderboardManager = leaderboardManager;
    }

    @Override
    public String getName() {
        return "tier";
    }

    @Override
    public CommandData getCommandData() {
        OptionData player = new OptionData(OptionType.USER, "player", "Player to set.", true);

        OptionData gamemode = new OptionData(OptionType.STRING, "gamemode", "Gamemode for this tier.", true)
            .addChoice("Axe & Shield", "axe-and-shield")
            .addChoice("Neth Pot", "neth-pot")
            .addChoice("SMP Kit", "smp-kit")
            .addChoice("Mace", "mace")
            .addChoice("Sword", "sword")
            .addChoice("UHC", "uhc")
            .addChoice("CPvP", "cpvp");

        OptionData tier = new OptionData(OptionType.STRING, "tier", "Tier to assign.", true);
        for (String name : TierLeaderboardManager.TIER_ORDER) {
            tier.addChoice(name, name);
        }

        OptionData ign = new OptionData(OptionType.STRING, "ign", "Optional Minecraft IGN to display.", false);

        return Commands.slash(getName(), "Manage player tiers.")
            .setDefaultPermissions(DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR))
            .addSubcommands(
                new net.dv8tion.jda.api.interactions.commands.build.SubcommandData("set", "Set a player's tier")
                    .addOptions(player, gamemode, tier, ign),
                new net.dv8tion.jda.api.interactions.commands.build.SubcommandData("remove", "Remove a player's tier")
                    .addOptions(player, gamemode)
            );
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        boolean isOwner = event.getMember().getIdLong() == event.getGuild().getOwnerIdLong();
        boolean isAdmin = event.getMember().hasPermission(Permission.ADMINISTRATOR);
        if (!isOwner && !isAdmin) {
            event.reply("⛔ Only server admins/owner can use this command.").setEphemeral(true).queue();
            return;
        }

        String subcommand = event.getSubcommandName();
        
        if ("set".equals(subcommand)) {
            handleSet(event);
        } else if ("remove".equals(subcommand)) {
            handleRemove(event);
        } else {
            event.reply("Unknown subcommand.").setEphemeral(true).queue();
        }
    }

    private void handleSet(SlashCommandInteractionEvent event) {
        OptionMapping playerOpt = event.getOption("player");
        OptionMapping gmOpt = event.getOption("gamemode");
        OptionMapping tierOpt = event.getOption("tier");
        
        if (playerOpt == null || gmOpt == null || tierOpt == null) {
            event.reply("Missing required options.").setEphemeral(true).queue();
            return;
        }
        
        long userId = playerOpt.getAsUser().getIdLong();
        String gamemodeKey = gmOpt.getAsString().trim().toLowerCase(Locale.ROOT);
        String tier = tierOpt.getAsString();
        String ign = event.getOption("ign") != null ? event.getOption("ign").getAsString() : "";
        
        leaderboardManager.upsertTier(userId, gamemodeKey, tier, ign, event.getUser().getIdLong());
        event.reply("✅ Set **" + tier + "** for <@" + userId + "> in **" + leaderboardManager.prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
    }

    private void handleRemove(SlashCommandInteractionEvent event) {
        OptionMapping playerOpt = event.getOption("player");
        OptionMapping gmOpt = event.getOption("gamemode");
        
        if (playerOpt == null || gmOpt == null) {
            event.reply("Missing required options.").setEphemeral(true).queue();
            return;
        }
        
        long userId = playerOpt.getAsUser().getIdLong();
        String gamemodeKey = gmOpt.getAsString().trim().toLowerCase(Locale.ROOT);
        
        leaderboardManager.removeTier(userId, gamemodeKey);
        event.reply("✅ Removed tier for <@" + userId + "> in **" + leaderboardManager.prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
    }
}
