package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.RegistrationManager;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.OptionType;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.SubcommandData;

public final class CooldownCommand implements DiscordSlashCommand {

    private final RegistrationManager registrationManager;

    public CooldownCommand(RegistrationManager registrationManager) {
        this.registrationManager = registrationManager;
    }

    @Override
    public String getName() {
        return "cooldown";
    }

    @Override
    public CommandData getCommandData() {
        return Commands.slash("cooldown", "Manage gamemode cooldowns")
            .addSubcommands(
                new SubcommandData("reset", "Reset a user's gamemode cooldown")
                    .addOption(OptionType.USER, "user", "The user to reset cooldown for", true)
            )
            .setDefaultPermissions(net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR));
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild()) {
            event.reply("⚠️ This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        if (event.getMember() == null) {
            event.reply("⚠️ This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        boolean isOwner = event.getMember().getIdLong() == event.getGuild().getOwnerIdLong();
        boolean isAdmin = event.getMember().hasPermission(Permission.ADMINISTRATOR);
        if (!isOwner && !isAdmin) {
            event.reply("⛔ Only server admins/owner can use this command.").setEphemeral(true).queue();
            return;
        }

        String subcommand = event.getSubcommandName();
        if (!"reset".equals(subcommand)) {
            event.reply("⚠️ Unknown subcommand.").setEphemeral(true).queue();
            return;
        }

        User targetUser = event.getOption("user").getAsUser();
        
        boolean success = registrationManager.resetGamemodeCooldown(targetUser.getIdLong());
        
        if (success) {
            event.reply("✅ Gamemode cooldown reset for " + targetUser.getAsMention() + ".").queue();
        } else {
            event.reply("⚠️ " + targetUser.getAsMention() + " has no active cooldown.").setEphemeral(true).queue();
        }
    }
}
