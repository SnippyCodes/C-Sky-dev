package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.RestrictionManager;
import java.util.Comparator;
import java.util.stream.Collectors;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.SubcommandData;

public final class RestrictCommand implements DiscordSlashCommand {

    private final RestrictionManager restrictionManager;

    public RestrictCommand(RestrictionManager restrictionManager) {
        this.restrictionManager = restrictionManager;
    }

    @Override
    public String getName() {
        return "restrict";
    }

    @Override
    public CommandData getCommandData() {
        return Commands.slash(getName(), "Restrict/unrestrict users from using the waitlist.")
            .addSubcommands(
                new SubcommandData("add", "Restrict a user from using the waitlist.")
                    .addOption(OptionType.USER, "user", "User to restrict", true),
                new SubcommandData("remove", "Remove restriction from a user.")
                    .addOption(OptionType.USER, "user", "User to unrestrict", true),
                new SubcommandData("list", "List restricted users.")
            )
            .setDefaultPermissions(DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR));
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("⚠️ This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        boolean isOwner = event.getMember().getIdLong() == event.getGuild().getOwnerIdLong();
        boolean isAdmin = event.getMember().hasPermission(Permission.ADMINISTRATOR);
        if (!isOwner && !isAdmin) {
            event.reply("⛔ Only server admins/owner can use this command.").setEphemeral(true).queue();
            return;
        }

        String sub = event.getSubcommandName();
        if ("add".equals(sub)) {
            User user = event.getOption("user").getAsUser();
            boolean changed = restrictionManager.restrict(user.getIdLong());
            event.reply(changed ? ("✅ Restricted " + user.getAsMention() + " from the waitlist.") : ("ℹ️ " + user.getAsMention() + " is already restricted."))
                .setEphemeral(true)
                .queue();
            return;
        }

        if ("remove".equals(sub)) {
            User user = event.getOption("user").getAsUser();
            boolean changed = restrictionManager.unrestrict(user.getIdLong());
            event.reply(changed ? ("✅ Unrestricted " + user.getAsMention() + ".") : ("ℹ️ " + user.getAsMention() + " is not restricted."))
                .setEphemeral(true)
                .queue();
            return;
        }

        if ("list".equals(sub)) {
            String list = restrictionManager.getRestrictedUsers().stream()
                .sorted(Comparator.naturalOrder())
                .map(id -> "<@" + id + "> (`" + id + "`)")
                .collect(Collectors.joining("\n"));
            if (list.isBlank()) {
                event.reply("✅ No restricted users.").setEphemeral(true).queue();
            } else {
                event.reply("Restricted users:\n" + list).setEphemeral(true).queue();
            }
            return;
        }

        event.reply("⚠️ Unknown subcommand.").setEphemeral(true).queue();
    }
}

