package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.WaitlistQueueManager;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.SubcommandData;

public final class WaitlistCommand implements DiscordSlashCommand {

    private final WaitlistQueueManager waitlistManager;

    public WaitlistCommand(WaitlistQueueManager waitlistManager) {
        this.waitlistManager = waitlistManager;
    }

    @Override
    public String getName() {
        return "waitlist";
    }

    @Override
    public CommandData getCommandData() {
        return Commands.slash(getName(), "Waitlist management commands.")
            .addSubcommands(
                new SubcommandData("start", "Start waitlist in this gamemode channel."),
                new SubcommandData("stop", "Stop waitlist in this gamemode channel."),
                new SubcommandData("next", "Pull next player and create a test channel.")
            );
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        String sub = event.getSubcommandName();
        if ("start".equalsIgnoreCase(sub)) {
            waitlistManager.handleStart(event);
            return;
        }
        if ("stop".equalsIgnoreCase(sub)) {
            waitlistManager.handleStop(event);
            return;
        }
        if ("next".equalsIgnoreCase(sub)) {
            waitlistManager.handleNext(event);
            return;
        }
        event.reply("Unknown waitlist subcommand.").setEphemeral(true).queue();
    }
}
