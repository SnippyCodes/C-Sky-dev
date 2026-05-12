package com.example.discordqueuebot.command;

import com.example.discordqueuebot.manager.TierLeaderboardManager;
import java.awt.Color;
import java.util.ArrayList;
import java.util.List;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.interactions.commands.DefaultMemberPermissions;
import net.dv8tion.jda.api.interactions.commands.build.CommandData;
import net.dv8tion.jda.api.interactions.commands.build.Commands;
import net.dv8tion.jda.api.interactions.commands.build.SubcommandData;

public final class RolesCommand implements DiscordSlashCommand {

    private static final List<String[]> GAMEMODES = List.of(
        new String[]{"axe-and-shield", "Axe"},
        new String[]{"neth-pot", "NethPot"},
        new String[]{"smp-kit", "SMP"},
        new String[]{"mace", "Mace"},
        new String[]{"sword", "Sword"},
        new String[]{"uhc", "UHC"},
        new String[]{"cpvp", "CPvP"}
    );

    @Override
    public String getName() {
        return "roles";
    }

    @Override
    public CommandData getCommandData() {
        return Commands.slash(getName(), "Role management.")
            .setDefaultPermissions(DefaultMemberPermissions.enabledFor(Permission.ADMINISTRATOR))
            .addSubcommands(
                new SubcommandData("generate", "Generate all gamemode tier roles (e.g. NethPot LT1).")
            );
    }

    @Override
    public void execute(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null) {
            event.reply("This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }
        if (!"generate".equalsIgnoreCase(event.getSubcommandName())) {
            event.reply("Unknown subcommand.").setEphemeral(true).queue();
            return;
        }

        event.deferReply(true).queue();
        Guild guild = event.getGuild();

        List<String> toCreate = new ArrayList<>();
        for (String[] gm : GAMEMODES) {
            String label = gm[1];
            for (String tier : TierLeaderboardManager.TIER_ORDER) {
                toCreate.add("[" + label + "-" + tier + "]");
            }
        }

        // Get existing role names to skip duplicates
        List<String> existing = guild.getRoles().stream()
            .map(r -> r.getName())
            .toList();

        List<String> skipped = new ArrayList<>();
        List<String> created = new ArrayList<>();

        createNext(guild, toCreate, existing, skipped, created, 0, event);
    }

    private void createNext(Guild guild, List<String> toCreate, List<String> existing,
                            List<String> skipped, List<String> created, int index,
                            SlashCommandInteractionEvent event) {
        if (index >= toCreate.size()) {
            String msg = "✅ Done! Created **" + created.size() + "** roles.";
            if (!skipped.isEmpty()) msg += "\n⏭️ Skipped (already exist): " + String.join(", ", skipped);
            event.getHook().sendMessage(msg).queue();
            return;
        }

        String roleName = toCreate.get(index);
        if (existing.contains(roleName)) {
            skipped.add(roleName);
            createNext(guild, toCreate, existing, skipped, created, index + 1, event);
            return;
        }

        // Get color based on gamemode
        Color roleColor = getGamemodeColor(roleName);

        guild.createRole()
            .setName(roleName)
            .setColor(roleColor)
            .setMentionable(false)
            .queue(
                role -> {
                    created.add(roleName);
                    createNext(guild, toCreate, existing, skipped, created, index + 1, event);
                },
                error -> {
                    skipped.add(roleName + " (error)");
                    createNext(guild, toCreate, existing, skipped, created, index + 1, event);
                }
            );
    }

    /**
     * Get color for gamemode
     * Sword - Blue, Mace - Gray, CPvP - Purple, NethPot - Red,
     * Axe - Green, UHC - Yellow, SMP - Orange
     */
    private Color getGamemodeColor(String roleName) {
        String lower = roleName.toLowerCase();
        if (lower.startsWith("sword")) return new Color(52, 152, 219);    // Blue
        if (lower.startsWith("mace")) return new Color(149, 165, 166);    // Gray
        if (lower.startsWith("cpvp")) return new Color(155, 89, 182);     // Purple
        if (lower.startsWith("nethpot")) return new Color(231, 76, 60);   // Red
        if (lower.startsWith("axe")) return new Color(46, 204, 113);      // Green
        if (lower.startsWith("uhc")) return new Color(241, 196, 15);      // Yellow
        if (lower.startsWith("smp")) return new Color(230, 126, 34);      // Orange
        return new Color(153, 170, 181); // Default gray
    }
}
