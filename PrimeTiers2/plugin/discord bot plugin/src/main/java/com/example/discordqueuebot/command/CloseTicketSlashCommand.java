package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.WaitlistQueueManager;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;

public final class CloseTicketSlashCommand implements DiscordSlashCommand {

    private final WaitlistQueueManager waitlistManager;

    public CloseTicketSlashCommand(WaitlistQueueManager waitlistManager) {
        this.waitlistManager = waitlistManager;
    }

    @Override
    public String getName() {
        return "closeticket";
    }

    @Override
    public CommandData getCommandData() {
        return Commands.slash("closeticket", "Close the current test ticket without assigning a tier");
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        waitlistManager.handleCloseTicket(event);
    }
}
