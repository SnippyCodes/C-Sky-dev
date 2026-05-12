package com.example.discordqueuebot.listener;

import com.example.discordqueuebot.manager.RegistrationManager;
import net.dv8tion.jda.api.events.interaction.ModalInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.StringSelectInteractionEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;
import org.jetbrains.annotations.NotNull;

public final class RegistrationListener extends ListenerAdapter {

    private final RegistrationManager registrationManager;

    public RegistrationListener(RegistrationManager registrationManager) {
        this.registrationManager = registrationManager;
    }

    @Override
    public void onButtonInteraction(@NotNull ButtonInteractionEvent event) {
        registrationManager.handleButton(event);
    }

    @Override
    public void onModalInteraction(@NotNull ModalInteractionEvent event) {
        registrationManager.handleModal(event);
    }

    @Override
    public void onStringSelectInteraction(@NotNull StringSelectInteractionEvent event) {
        registrationManager.handleStringSelect(event);
    }
}
