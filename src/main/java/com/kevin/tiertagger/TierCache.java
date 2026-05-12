package com.kevin.tiertagger;

import com.kevin.tiertagger.model.GameMode;
import com.kevin.tiertagger.model.PlayerInfo;
import net.minecraft.client.Minecraft;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

public class TierCache {
    private static final List<GameMode> GAMEMODES = new ArrayList<>();
    private static final Map<UUID, CompletableFuture<Optional<Map<String, PlayerInfo.Ranking>>>> TIERS = new ConcurrentHashMap<>();

    public static void init() {
        try {
            GAMEMODES.clear();
            GAMEMODES.addAll(GameMode.fetchGamemodes(TierTagger.getClient()).get());
            TierTagger.getLogger().info("Found {} tierlists: {}", GAMEMODES.size(), GAMEMODES.stream().map(GameMode::id).toList());
        } catch (ExecutionException e) {
            TierTagger.getLogger().error("Failed to load gamemodes!", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public static List<GameMode> getGamemodes() {
        if (GAMEMODES.isEmpty()) {
            return Collections.singletonList(GameMode.NONE);
        } else {
            return GAMEMODES;
        }
    }

    public static Optional<Map<String, PlayerInfo.Ranking>> getPlayerRankings(UUID uuid) {
        String linked = TierTagger.getManager().getConfig().getLinkedPlayers().get(uuid.toString());
        UUID finalUuid = linked != null ? parseUUID(linked) : uuid;

        CompletableFuture<Optional<Map<String, PlayerInfo.Ranking>>> existing = TIERS.get(uuid);
        if (existing != null) {
            return existing.isDone() ? existing.join() : Optional.empty();
        }

        CompletableFuture<Optional<Map<String, PlayerInfo.Ranking>>> future = new CompletableFuture<>();
        CompletableFuture<Optional<Map<String, PlayerInfo.Ranking>>> race = TIERS.putIfAbsent(uuid, future);
        if (race != null) {
            return race.isDone() ? race.join() : Optional.empty();
        }

        PlayerInfo.get(TierTagger.getClient(), finalUuid).thenAccept(info -> {
            if (info != null) {
                future.complete(Optional.of(info.rankings()));
            } else {
                String username = getIngameName(uuid);
                if (username != null) {
                    PlayerInfo.search(TierTagger.getClient(), username).thenAccept(p -> {
                        if (p != null && p.rankings() != null) {
                            TierTagger.getManager().getConfig().getLinkedPlayers()
                                    .put(uuid.toString(), p.uuid());
                            TierTagger.getManager().saveConfig();
                            future.complete(Optional.of(p.rankings()));
                        } else {
                            future.complete(Optional.empty());
                        }
                    });
                } else {
                    future.complete(Optional.empty());
                }
            }
        });

        return Optional.empty();
    }

    private static String getIngameName(UUID uuid) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.getConnection() == null) return null;
        net.minecraft.client.multiplayer.PlayerInfo info = mc.getConnection().getPlayerInfo(uuid);
        return info != null ? info.getProfile().name() : null;
    }

    public static CompletableFuture<PlayerInfo> searchPlayer(String query) {
        return PlayerInfo.search(TierTagger.getClient(), query).thenApply(p -> {
            if (p == null) return null;
            UUID uuid = parseUUID(p.uuid());
            TIERS.put(uuid, CompletableFuture.completedFuture(Optional.of(p.rankings())));
            return p;
        });
    }

    public static void clearCache() {
        TIERS.clear();
    }

    public static GameMode findNextMode(GameMode current) {
        if (GAMEMODES.isEmpty()) {
            return GameMode.NONE;
        } else {
            return GAMEMODES.get((GAMEMODES.indexOf(current) + 1) % GAMEMODES.size());
        }
    }

    public static Optional<GameMode> findMode(String id) {
        return GAMEMODES.stream().filter(m -> m.id().equalsIgnoreCase(id)).findFirst();
    }

    public static GameMode findModeOrUgly(String id) {
        return findMode(id).orElseGet(() -> new GameMode(id, id));
    }

    private static UUID parseUUID(String uuid) {
        try {
            return UUID.fromString(uuid);
        } catch (Exception e) {
            long mostSignificant = Long.parseUnsignedLong(uuid.substring(0, 16), 16);
            long leastSignificant = Long.parseUnsignedLong(uuid.substring(16), 16);
            return new UUID(mostSignificant, leastSignificant);
        }
    }

    private TierCache() {
    }
}
