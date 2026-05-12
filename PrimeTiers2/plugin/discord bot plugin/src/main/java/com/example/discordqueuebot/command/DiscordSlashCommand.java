package com.example.discordqueuebot.command;

import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;

public interface DiscordSlashCommand {

    String getName();

    CommandData getCommandData();

    void execute(SlashCommandInteractionEvent event);
}
