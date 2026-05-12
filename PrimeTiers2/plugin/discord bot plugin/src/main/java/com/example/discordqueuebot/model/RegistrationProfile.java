package com.example.discordqueuebot.model;

import java.time.Instant;
import java.util.List;

public record RegistrationProfile(
    long userId,
    String ign,
    String accountType,
    String preferredServer,
    String gameMode,
    String skinUrl,
    Instant updatedAt
) {
}
