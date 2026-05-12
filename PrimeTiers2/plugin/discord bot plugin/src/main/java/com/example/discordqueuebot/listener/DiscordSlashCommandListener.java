package com.example.discordqueuebot.listener;

import com.example.discordqueuebot.command.DiscordSlashCommand;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.jetbrains.annotations.NotNull;

public final class DiscordSlashCommandListener extends ListenerAdapter {

    private final Map<String, DiscordSlashCommand> commands = new HashMap<>();

    public DiscordSlashCommandListener(List<DiscordSlashCommand> commandList) {
        for (DiscordSlashCommand command : commandList) {
            this.commands.put(command.getName(), command);
        }
    }

    @Override
    public void onSlashCommandInteraction(@NotNull SlashCommandInteractionEvent event) {
        DiscordSlashCommand command = commands.get(event.getName());
        if (command != null) {
            command.execute(event);
        }
    }
}
