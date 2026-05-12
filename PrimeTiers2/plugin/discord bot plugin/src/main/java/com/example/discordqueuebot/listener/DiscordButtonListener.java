package com.example.discordqueuebot.listener;

import com.example.discordqueuebot.manager.TierLeaderboardManager;
import com.example.discordqueuebot.manager.WaitlistQueueManager;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.jetbrains.annotations.NotNull;

public final class DiscordButtonListener extends ListenerAdapter {

    private final TierLeaderboardManager tierLeaderboardManager;
    private final WaitlistQueueManager waitlistQueueManager;

    public DiscordButtonListener(TierLeaderboardManager tierLeaderboardManager, WaitlistQueueManager waitlistQueueManager) {
        this.tierLeaderboardManager = tierLeaderboardManager;
        this.waitlistQueueManager = waitlistQueueManager;
    }

    @Override
    public void onButtonInteraction(@NotNull ButtonInteractionEvent event) {
        String id = event.getComponentId();

        if (id != null && id.startsWith("lb_gm:")) {
            event.deferReply(true).queue(
                hook -> tierLeaderboardManager.handleGamemodeButton(id, message -> event.getHook().sendMessage(message).queue()),
                failure -> event.reply("❌ Couldn't process this button. Please try again.").setEphemeral(true).queue()
            );
            return;
        }

        if (id != null && id.startsWith("wl_")) {
            waitlistQueueManager.handleButton(event);
            return;
        }

        if (id != null && id.startsWith(WaitlistQueueManager.TICKET_RESULT_PREFIX)) {
            waitlistQueueManager.handleButton(event);
        }
    }
}
