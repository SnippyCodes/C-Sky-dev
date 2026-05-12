package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.RegistrationManager;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.Permission;

public final class SendRegisterPanelCommand implements DiscordSlashCommand {

    private final RegistrationManager registrationManager;

    public SendRegisterPanelCommand(RegistrationManager registrationManager) {
        this.registrationManager = registrationManager;
    }

    @Override
    public String getName() {
        return "sendregisterpanel";
    }

    @Override
    public CommandData getCommandData() {
        return Commands.slash(getName(), "Send the registration panel in the configured register channel.")
            .setDefaultPermissions(DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR));
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        registrationManager.handleSendRegisterPanel(event);
    }
}
