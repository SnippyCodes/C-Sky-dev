package com.kevin.tiertagger.model;

import it.unimi.dsi.fastutil.Pair;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.TextColor;

import java.net.http.HttpClient;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public record GameMode(String id, String title) {
    public static final GameMode NONE = new GameMode("annoying_long_id_that_no_one_will_ever_use_just_to_make_sure", "§cNone§r");

    public static CompletableFuture<List<GameMode>> fetchGamemodes(HttpClient client) {
        // PrimeTiers API doesn't have a /v2/mode/list endpoint.
        // Return the known gamemodes for PrimeTiers directly.
        return CompletableFuture.completedFuture(List.of(
                new GameMode("sword",    "Sword"),
                new GameMode("axe",      "Axe"),
                new GameMode("pot",      "Pot"),
                new GameMode("neth_pot", "NethPot"),
                new GameMode("uhc",      "UHC"),
                new GameMode("crystal",  "Crystal"),
                new GameMode("smp",      "SMP"),
                new GameMode("mace",     "Mace")
        ));
    }

    public boolean isNone() {
        return this.id.equals(NONE.id);
    }

    private Pair<Character, TextColor> iconAndColor() {
        return switch (this.id) {
            case "axe" -> Pair.of('\uE701', TextColor.fromLegacyFormat(ChatFormatting.GREEN));
            case "mace" -> Pair.of('\uE702', TextColor.fromLegacyFormat(ChatFormatting.GRAY));
            case "nethop", "neth_pot" -> Pair.of('\uE703', TextColor.fromRgb(0x7d4a40));
            case "pot" -> Pair.of('\uE704', TextColor.fromRgb(0xff0000));
            case "smp" -> Pair.of('\uE705', TextColor.fromRgb(0xeccb45));
            case "sword" -> Pair.of('\uE706', TextColor.fromRgb(0xa4fdf0));
            case "uhc" -> Pair.of('\uE707', TextColor.fromLegacyFormat(ChatFormatting.RED));
            case "vanilla" -> Pair.of('\uE708', TextColor.fromLegacyFormat(ChatFormatting.LIGHT_PURPLE));
            case "bed" -> Pair.of('\uE801', TextColor.fromRgb(0xff0000));
            case "bow" -> Pair.of('\uE802', TextColor.fromRgb(0x663d10));
            case "creeper" -> Pair.of('\uE803', TextColor.fromLegacyFormat(ChatFormatting.GREEN));
            case "debuff" -> Pair.of('\uE804', TextColor.fromLegacyFormat(ChatFormatting.DARK_GRAY));
            case "dia_crystal" -> Pair.of('\uE805', TextColor.fromLegacyFormat(ChatFormatting.AQUA));
            case "dia_smp" -> Pair.of('\uE806', TextColor.fromRgb(0x8c668b));
            case "elytra" -> Pair.of('\uE807', TextColor.fromRgb(0x8d8db1));
            case "manhunt" -> Pair.of('\uE808', TextColor.fromLegacyFormat(ChatFormatting.RED));
            case "minecart" -> Pair.of('\uE809', TextColor.fromLegacyFormat(ChatFormatting.GRAY));
            case "og_vanilla" -> Pair.of('\uE810', TextColor.fromLegacyFormat(ChatFormatting.GOLD));
            case "speed" -> Pair.of('\uE811', TextColor.fromRgb(0x43a9d1));
            case "trident" -> Pair.of('\uE812', TextColor.fromRgb(0x579b8c));
            default -> Pair.of('•', TextColor.fromLegacyFormat(ChatFormatting.WHITE));
        };
    }

    public Optional<Character> icon() {
        Pair<Character, TextColor> pair = this.iconAndColor();

        return pair.right().getValue() == 0xFFFFFF ? Optional.empty() : Optional.of(pair.left());
    }

    public Component asStyled(boolean withDefaultDot) {
        Pair<Character, TextColor> pair = this.iconAndColor();

        if (pair.right().getValue() == 0xFFFFFF && !withDefaultDot) {
            return Component.literal(this.title);
        } else {
            Component name = Component.literal(this.title).withStyle(s -> s.withColor(pair.right()));
            return Component.literal(pair.left() + " ").append(name);
        }
    }
}
