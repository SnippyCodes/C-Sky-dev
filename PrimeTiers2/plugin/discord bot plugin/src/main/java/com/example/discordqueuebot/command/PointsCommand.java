package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.PointsManager;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.OptionMapping;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.OptionData;
import net.dv8tion.jda.api.interactions.commands.build.SubcommandData;

public final class PointsCommand implements DiscordSlashCommand {

    private final PointsManager pointsManager;

    public PointsCommand(PointsManager pointsManager) {
        this.pointsManager = pointsManager;
    }

    @Override
    public String getName() {
        return "points";
    }

    @Override
    public CommandData getCommandData() {
        OptionData mcName = new OptionData(OptionType.STRING, "mc_name", "Minecraft username.", true);
        OptionData amount = new OptionData(OptionType.INTEGER, "amount", "Points amount.", true);

        return Commands.slash(getName(), "Manage player points.")
            .setDefaultPermissions(DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR))
            .addSubcommands(
                new SubcommandData("add", "Add points to a player.").addOptions(mcName, amount),
                new SubcommandData("remove", "Remove points from a player.").addOptions(mcName, amount),
                new SubcommandData("set", "Set a player's points.").addOptions(mcName, amount),
                new SubcommandData("check", "Check a player's points.").addOptions(mcName)
            );
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        String sub = event.getSubcommandName();
        OptionMapping mcOpt = event.getOption("mc_name");
        if (mcOpt == null) {
            event.reply("Missing mc_name.").setEphemeral(true).queue();
            return;
        }
        String mc = mcOpt.getAsString().trim();

        if ("check".equalsIgnoreCase(sub)) {
            int pts = pointsManager.get(mc);
            event.reply("**" + mc + "** has **" + pts + "** points.").queue();
            return;
        }

        // add/remove/set require admin
        if (!event.getMember().hasPermission(Permission.ADMINISTRATOR)) {
            event.reply("⛔ Only admins can use this.").setEphemeral(true).queue();
            return;
        }

        OptionMapping amtOpt = event.getOption("amount");
        if (amtOpt == null) {
            event.reply("Missing amount.").setEphemeral(true).queue();
            return;
        }
        int amount = amtOpt.getAsInt();

        int result = switch (sub.toLowerCase()) {
            case "add"    -> pointsManager.add(mc, amount);
            case "remove" -> pointsManager.remove(mc, amount);
            case "set"    -> pointsManager.set(mc, amount);
            default       -> -1;
        };

        if (result == -1) {
            event.reply("Unknown subcommand.").setEphemeral(true).queue();
            return;
        }

        event.reply("✅ **" + mc + "** now has **" + result + "** points.").setEphemeral(true).queue();
    }
}
