package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.model.RegistrationProfile;
import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.components.actionrow.ActionRow;
import net.dv8tion.jda.api.components.buttons.Button;
import net.dv8tion.jda.api.components.label.Label;
import net.dv8tion.jda.api.components.selections.StringSelectMenu;
import net.dv8tion.jda.api.components.textinput.TextInput;
import net.dv8tion.jda.api.components.textinput.TextInputStyle;
import net.dv8tion.jda.api.entities.MessageEmbed;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.channel.concrete.Category;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.events.interaction.ModalInteractionEvent;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.StringSelectInteractionEvent;
import net.dv8tion.jda.api.modals.Modal;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

public final class RegistrationManager {

    private static final String REGISTER_BUTTON_ID = "register_profile_button";
    private static final String REGISTER_MODAL_ID = "register_profile_modal";
    private static final String REGISTER_ACCOUNT_TYPE_SELECT_ID = "register_account_type_select";
    private static final String GAMEMODE_SELECT_ID = "register_gamemode_select";
    private static final String REQUEST_CHANNEL_PREFIX = "test-req";

    private final DiscordQueuePlugin plugin;
    private final File registrationsFile;
    private final File waitlistFile;
    private final Map<Long, RegistrationProfile> profiles = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> requestChannelsByUserGamemode = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, String> pendingAccountTypes = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Long> waitlistCooldowns = new ConcurrentHashMap<>();
    // userId:gamemodeKey -> last test completion millis
    private final ConcurrentMap<String, Long> testCooldowns = new ConcurrentHashMap<>();
    private final ConcurrentMap<Long, GamemodeSelection> gamemodeCooldowns = new ConcurrentHashMap<>();

    public RegistrationManager(DiscordQueuePlugin plugin) {
        this.plugin = plugin;
        this.registrationsFile = new File(plugin.getDataFolder(), "registrations.yml");
        this.waitlistFile = new File(plugin.getDataFolder(), "waitlist.yml");
        loadProfiles();
        loadWaitlistCooldowns();
    }

    public void handleSendRegisterPanel(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getMember() == null || event.getGuild() == null) {
            event.reply("This command can only be used in a server channel.").setEphemeral(true).queue();
            return;
        }
        if (!event.getMember().hasPermission(Permission.MANAGE_CHANNEL)) {
            event.reply("You need Manage Channels to send the registration panel.").setEphemeral(true).queue();
            return;
        }

        long registerChannelId = plugin.getConfig().getLong("register-channel-id", 0L);
        if (registerChannelId <= 0L) {
            event.reply("Set `register-channel-id` in config.yml first.").setEphemeral(true).queue();
            return;
        }

        TextChannel registerChannel = event.getGuild().getTextChannelById(registerChannelId);
        if (registerChannel == null) {
            event.reply("Configured register channel was not found in this server.").setEphemeral(true).queue();
            return;
        }

        registerChannel.sendMessageEmbeds(buildRegistrationEmbed())
            .setComponents(
                ActionRow.of(Button.success(REGISTER_BUTTON_ID, "Register / Update Profile")),
                ActionRow.of(buildGamemodeSelectMenu())
            )
            .queue(
                success -> event.reply("✅ Registration panel sent in " + registerChannel.getAsMention() + ".").setEphemeral(true).queue(),
                error -> event.reply("❌ Failed to send the registration panel: " + error.getMessage()).setEphemeral(true).queue()
            );
    }

    public void handleButton(ButtonInteractionEvent event) {
        if (!REGISTER_BUTTON_ID.equals(event.getComponentId())) {
            return;
        }

        event.replyEmbeds(new EmbedBuilder()
                .setTitle("📝 Profile Registration — Step 1/2")
                .setColor(new Color(88, 101, 242))
                .setDescription("👀 Select your **account type** below to continue.")
                .build())
            .setEphemeral(true)
            .setComponents(ActionRow.of(StringSelectMenu.create(REGISTER_ACCOUNT_TYPE_SELECT_ID)
                .setPlaceholder("🔍 Select your account type")
                .addOption("💻 Premium (Official Minecraft)", "Premium")
                .addOption("🔓 Cracked", "Cracked")
                .build()))
            .queue();
    }

    public void handleStringSelect(StringSelectInteractionEvent event) {
        if (REGISTER_ACCOUNT_TYPE_SELECT_ID.equals(event.getComponentId())) {
            handleAccountTypeSelect(event);
            return;
        }
        if (GAMEMODE_SELECT_ID.equals(event.getComponentId())) {
            handleGamemodeSelect(event);
        }
    }

    private void handleAccountTypeSelect(StringSelectInteractionEvent event) {
        String selectedType = event.getValues().get(0);
        pendingAccountTypes.put(event.getUser().getIdLong(), selectedType);

        RegistrationProfile existing = profiles.get(event.getUser().getIdLong());

        TextInput.Builder ignBuilder = TextInput.create("ign", TextInputStyle.SHORT)
            .setPlaceholder("Enter your Minecraft username")
            .setRequiredRange(2, 16);
        if (existing != null && existing.ign() != null && !existing.ign().isBlank()) {
            ignBuilder.setValue(existing.ign());
        }

        TextInput.Builder skinUrlBuilder = TextInput.create("skin_url", TextInputStyle.SHORT)
            .setPlaceholder("Paste your skin image URL here (Cracked Only)")
            .setRequired(false)
            .setRequiredRange(0, 256);
        if (existing != null && existing.skinUrl() != null && !existing.skinUrl().isBlank()) {
            skinUrlBuilder.setValue(existing.skinUrl());
        }

        Modal modal = Modal.create(REGISTER_MODAL_ID, "Profile Registration - Step 2/2")
            .addComponents(
                Label.of("In-Game Username (IGN)", ignBuilder.build()),
                Label.of("Skin URL (Cracked Only)", skinUrlBuilder.build())
            )
            .build();

        event.replyModal(modal).queue();
    }

    public void handleModal(ModalInteractionEvent event) {
        if (!REGISTER_MODAL_ID.equals(event.getModalId())) {
            return;
        }

        if (!event.isFromGuild() || event.getUser() == null) {
            event.reply("This popup can only be used inside a Discord server.").setEphemeral(true).queue();
            return;
        }

        String ign = event.getValue("ign") == null ? "" : event.getValue("ign").getAsString().trim();
        String skinUrl = event.getValue("skin_url") == null ? "" : event.getValue("skin_url").getAsString().trim();

        RegistrationProfile existing = profiles.get(event.getUser().getIdLong());
        String gameMode = (existing != null && existing.gameMode() != null && !existing.gameMode().isBlank())
            ? existing.gameMode() : "";
        String preferredServer = (existing != null && existing.preferredServer() != null) ? existing.preferredServer() : "";
        String accountType = pendingAccountTypes.remove(event.getUser().getIdLong());
        if (accountType == null || accountType.isBlank()) {
            accountType = (existing != null && existing.accountType() != null) ? existing.accountType() : "Premium";
        }

        if (ign.isBlank()) {
            event.reply("IGN cannot be empty.").setEphemeral(true).queue();
            return;
        }
        if (!isValidAccountType(accountType)) {
            event.reply("Account type must be `Premium` or `Cracked`.").setEphemeral(true).queue();
            return;
        }
        if ("cracked".equalsIgnoreCase(accountType) && skinUrl.isBlank()) {
            event.reply("Skin URL is required for `Cracked` accounts.").setEphemeral(true).queue();
            return;
        }

        String resolvedSkinUrl = "cracked".equalsIgnoreCase(accountType) ? skinUrl : "";

        RegistrationProfile profile = new RegistrationProfile(
            event.getUser().getIdLong(),
            ign,
            accountType,
            preferredServer,
            gameMode,
            resolvedSkinUrl,
            Instant.now()
        );
        profiles.put(profile.userId(), profile);
        saveProfiles();

        UuidAndSkin uuidAndSkin = resolveUuidAndSkin(profile);

        // Log registration to logs channel
        logRegistration(event.getUser(), profile, uuidAndSkin);

        EmbedBuilder savedEmbed = new EmbedBuilder()
            .setTitle("✅ Profile saved")
            .setColor(new Color(46, 204, 113))
            .addField("👤 Username", profile.ign(), true)
            .addField("💻 Account Type", profile.accountType(), true);

        if (profile.preferredServer() != null && !profile.preferredServer().isBlank()) {
            savedEmbed.addField("🌐 Region", profile.preferredServer(), true);
        }

        if ("premium".equalsIgnoreCase(profile.accountType())) {
            savedEmbed.addField("🆔 UUID", uuidAndSkin.uuid(), false);
        }

        if (uuidAndSkin.skinImage() != null && !uuidAndSkin.skinImage().isBlank()) {
            savedEmbed.setThumbnail(uuidAndSkin.skinImage());
        }

        event.replyEmbeds(savedEmbed.build())
            .setEphemeral(true)
            .setComponents(ActionRow.of(buildGamemodeSelectMenu()))
            .queue();
    }

    private void logRegistration(net.dv8tion.jda.api.entities.User user, RegistrationProfile profile, UuidAndSkin uuidAndSkin) {
        long logsChannelId = plugin.getConfig().getLong("logs-channel-id", 0L);
        if (logsChannelId <= 0L) return;

        TextChannel logsChannel = user.getJDA().getTextChannelById(logsChannelId);
        if (logsChannel == null) return;

        EmbedBuilder embed = new EmbedBuilder()
            .setTitle("✅ Profile Registration Complete!")
            .setColor(new Color(46, 204, 113))
            .setDescription("Your profile has been successfully saved.")
            .addField("👤 Username", profile.ign(), true)
            .addField("💻 Account Type", profile.accountType(), true)
            .setFooter("PrimeTiers 🔥")
            .setTimestamp(Instant.now());

        if ("premium".equalsIgnoreCase(profile.accountType())) {
            embed.addField("🆔 UUID", uuidAndSkin.uuid(), false);
        }
        
        if (uuidAndSkin.skinImage() != null && !uuidAndSkin.skinImage().isBlank()) {
            embed.setThumbnail(uuidAndSkin.skinImage());
        }

        logsChannel.sendMessageEmbeds(embed.build()).queue();
    }

    private record UuidAndSkin(String uuid, String skinImage) {}

    private UuidAndSkin resolveUuidAndSkin(RegistrationProfile profile) {
        if (profile == null) return new UuidAndSkin("N/A", "");

        if ("cracked".equalsIgnoreCase(profile.accountType())) {
            String crackedSkin = (profile.skinUrl() == null) ? "" : profile.skinUrl().trim();
            return new UuidAndSkin("N/A", crackedSkin);
        }

        if (!"premium".equalsIgnoreCase(profile.accountType())) {
            return new UuidAndSkin("N/A", "");
        }

        String uuid = "N/A";
        String rawUuid = null;
        try {
            String apiUrl = "https://api.mojang.com/users/profiles/minecraft/" + profile.ign();
            java.net.URL url = new java.net.URL(apiUrl);
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
                conn.setRequestProperty("User-Agent", "PrimeTiersBot/2.7.0");

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                String json = response.toString();
                int idIndex = json.indexOf("\"id\":\"");
                if (idIndex != -1) {
                    int start = idIndex + 6;
                    int end = json.indexOf("\"", start);
                    if (end != -1) {
                        rawUuid = json.substring(start, end);
                        if (rawUuid.length() == 32) {
                            uuid = rawUuid.substring(0, 8) + "-" + rawUuid.substring(8, 12) + "-" +
                                rawUuid.substring(12, 16) + "-" + rawUuid.substring(16, 20) + "-" + rawUuid.substring(20);
                        }
                    }
                }
            } else if (responseCode == 204) {
                uuid = "Player not found";
            } else {
                uuid = "Lookup failed (code " + responseCode + ")";
            }
            conn.disconnect();
        } catch (Exception e) {
            uuid = "Lookup failed";
        }

        String skinImage;
        if (rawUuid != null && rawUuid.length() == 32) {
            skinImage = "https://visage.surgeplay.com/bust/" + rawUuid + "?overlay";
        } else {
            String encodedIgn = java.net.URLEncoder.encode(profile.ign(), java.nio.charset.StandardCharsets.UTF_8);
            skinImage = "https://visage.surgeplay.com/bust/" + encodedIgn + "?overlay";
        }

        return new UuidAndSkin(uuid, skinImage);
    }

    public void handleGamemodeSelect(StringSelectInteractionEvent event) {
        if (!GAMEMODE_SELECT_ID.equals(event.getComponentId())) return;
        String selected = event.getValues().get(0);
        RegistrationProfile existing = profiles.get(event.getUser().getIdLong());
        if (existing == null) {
            event.reply("📝 Please register your profile first using the Register button.").setEphemeral(true).queue();
            return;
        }

        // Check gamemode cooldown
        long gamemodeCooldownDays = plugin.getConfig().getLong("gamemode-cooldown-days", 5L);
        long cooldownMillis = java.time.temporal.ChronoUnit.DAYS.getDuration().toMillis() * Math.max(0L, gamemodeCooldownDays);
        long now = System.currentTimeMillis();
        GamemodeSelection lastSelection = gamemodeCooldowns.get(event.getUser().getIdLong());
        
        if (cooldownMillis > 0L && lastSelection != null && !selected.equalsIgnoreCase(lastSelection.gamemode())) {
            long elapsed = now - lastSelection.timestamp();
            if (elapsed >= 0L && elapsed < cooldownMillis) {
                long remainingMillis = cooldownMillis - elapsed;
                long remainingDays = Math.max(1L, (long) Math.ceil(remainingMillis / (double) java.time.temporal.ChronoUnit.DAYS.getDuration().toMillis()));
                event.reply("⏳ You already received the **Waitlist [" + lastSelection.gamemode() + "]** role.\n🗓️ Your cooldown ends in **" + remainingDays + " day(s)**.").setEphemeral(true).queue();
                return;
            }
        }

        RegistrationProfile updated = new RegistrationProfile(
            existing.userId(), existing.ign(), existing.accountType(),
            existing.preferredServer(), selected, existing.skinUrl(), existing.updatedAt()
        );
        profiles.put(updated.userId(), updated);
        saveProfiles();
        
        gamemodeCooldowns.put(event.getUser().getIdLong(), new GamemodeSelection(selected, now));
        
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("Gamemode set to **" + selected + "**.").setEphemeral(true).queue();
            return;
        }

        event.deferReply(true).queue();
        assignWaitlistRole(event, selected, msg -> event.getHook().sendMessage(msg).queue());
    }

    public RegistrationProfile getProfile(long userId) {
        return profiles.get(userId);
    }

    public java.util.Collection<RegistrationProfile> getAllProfiles() {
        return profiles.values();
    }

    private MessageEmbed buildRegistrationEmbed() {
        return new EmbedBuilder()
            .setTitle("📋 PrimeTiers Testing Waitlist & Roles")
            .setColor(new Color(231, 76, 60))
            .setTimestamp(Instant.now())
            .setDescription("""
**Step 1: Register Your Profile**
Click the **Register / Update Profile** button to save your IGN and account type.

**Step 2: Get a Waitlist Role**
After registering, use the dropdown to select a gamemode and receive its waitlist role (**%s-day cooldown** per gamemode).

• **Username:** the account you will be testing on
• **Account Type:** Premium or Cracked

👾 **Skin URL (Cracked Only)**
• Mineskin.org → upload skin → Generate
• Copy Image Address from the preview
• Paste that URL in the register form

⚠️ Failure to provide authentic information may result in a denied test.
""".formatted(plugin.getConfig().getLong("waitlist-cooldown-days", 5L)))
            .setFooter("PrimeTiers")
            .build();
    }

    private StringSelectMenu buildGamemodeSelectMenu() {
        return StringSelectMenu.create(GAMEMODE_SELECT_ID)
            .setPlaceholder("Select a gamemode to get the waitlist role")
            .addOption("🪓 Axe & Shield", "Axe & Shield")
            .addOption("🍶 Neth Pot", "Neth Pot")
            .addOption("💎 Dia Pot", "Dia Pot")
            .addOption("🌿 SMP Kit", "SMP Kit")
            .addOption("🔨 Mace", "Mace")
            .addOption("⚔️ Sword", "Sword")
            .addOption("🌍 UHC", "UHC")
            .addOption("💥 CPvP", "CPvP")
            .build();
    }

    private void assignWaitlistRole(StringSelectInteractionEvent event, String gamemode, java.util.function.Consumer<String> callback) {
        if (event.getGuild() == null || event.getMember() == null) {
            callback.accept("Gamemode set to **" + gamemode + "**.");
            return;
        }

        String cooldownKey = buildUserGamemodeKey(event.getUser().getIdLong(), gamemode);
        long cooldownDays = plugin.getConfig().getLong("waitlist-cooldown-days", 5L);
        long cooldownMillis = ChronoUnit.DAYS.getDuration().toMillis() * Math.max(0L, cooldownDays);
        long now = System.currentTimeMillis();
        Long lastAssignedAt = waitlistCooldowns.get(cooldownKey);
        if (cooldownMillis > 0L && lastAssignedAt != null) {
            long elapsed = now - lastAssignedAt;
            if (elapsed >= 0L && elapsed < cooldownMillis) {
                long remainingMillis = cooldownMillis - elapsed;
                long remainingDays = Math.max(1L, (long) Math.ceil(remainingMillis / (double) ChronoUnit.DAYS.getDuration().toMillis()));
                callback.accept("⏳ You already received the **Waitlist [" + gamemode + "]** role.\n🗓️ Your cooldown ends in **" + remainingDays + " day(s)**.");
                return;
            }
        }

        String rolePath = "waitlist-roles." + normalizeGamemodeKey(gamemode);
        long roleId = plugin.getConfig().getLong(rolePath, 0L);
        if (roleId <= 0L) {
            callback.accept("✅ Gamemode set to **" + gamemode + "**.\n⚠️ Waitlist role not configured.");
            return;
        }

        Role role = event.getGuild().getRoleById(roleId);
        if (role == null) {
            callback.accept("✅ Gamemode set to **" + gamemode + "**.\n⚠️ Waitlist role not found.");
            return;
        }

        if (event.getMember().getRoles().contains(role)) {
            waitlistCooldowns.put(cooldownKey, now);
            saveWaitlistCooldowns();
            callback.accept(buildWaitlistGrantMessage(event, gamemode, cooldownDays, role));
            return;
        }

        event.getGuild().addRoleToMember(event.getMember(), role).queue(
            success -> {
                waitlistCooldowns.put(cooldownKey, now);
                saveWaitlistCooldowns();
                callback.accept(buildWaitlistGrantMessage(event, gamemode, cooldownDays, role));
            },
            failure -> callback.accept("Gamemode set to **" + gamemode + "**. Role give failed: " + failure.getMessage())
        );
    }

    private String buildWaitlistGrantMessage(StringSelectInteractionEvent event, String gamemode, long cooldownDays, Role waitlistRole) {
        StringBuilder message = new StringBuilder();
        message.append("🎉 You received the **Waitlist [").append(gamemode).append("]** role!\n")
            .append("🗓️ Cooldown ends in **").append(cooldownDays).append(" day(s)**.\n")
            .append("🏷️ Role: ").append(waitlistRole.getAsMention());

        TextChannel waitlistChannel = resolveWaitlistChannel(event, gamemode);
        if (waitlistChannel != null) {
            message.append("\n📌 Channel: ").append(waitlistChannel.getAsMention());
            ensureWaitlistChannelPermissions(event, waitlistRole, waitlistChannel);
        }
        return message.toString();
    }

    private TextChannel resolveWaitlistChannel(StringSelectInteractionEvent event, String gamemode) {
        if (event.getGuild() == null) {
            return null;
        }
        String channelPath = "waitlist-channels." + normalizeGamemodeKey(gamemode);
        long channelId = plugin.getConfig().getLong(channelPath, 0L);
        if (channelId <= 0L) {
            return null;
        }
        return event.getGuild().getTextChannelById(channelId);
    }

    private void ensureWaitlistChannelPermissions(StringSelectInteractionEvent event, Role waitlistRole, TextChannel channel) {
        // Ensure the role can see the channel (server can still manage more strict perms manually).
        channel.upsertPermissionOverride(waitlistRole)
            .setAllowed(Permission.VIEW_CHANNEL, Permission.MESSAGE_HISTORY)
            .queue(
                success -> {
                },
                failure -> {
                }
            );

        if (event.getGuild() == null) {
            return;
        }
        long testerRoleId = plugin.getConfig().getLong("tester-role-id", 0L);
        if (testerRoleId > 0L) {
            Role testerRole = event.getGuild().getRoleById(testerRoleId);
            if (testerRole != null) {
                channel.upsertPermissionOverride(testerRole)
                    .setAllowed(Permission.VIEW_CHANNEL, Permission.MESSAGE_SEND, Permission.MESSAGE_HISTORY, Permission.MESSAGE_EMBED_LINKS, Permission.MESSAGE_ATTACH_FILES)
                    .queue(
                        success -> {
                        },
                        failure -> {
                        }
                    );
            }
        }
    }

    private String normalizeGamemodeKey(String gamemode) {
        return gamemode.trim()
            .toLowerCase()
            .replace("&", "and")
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-|-$", "");
    }

    private String buildUserGamemodeKey(long userId, String gamemode) {
        return userId + ":" + gamemode.trim().toLowerCase();
    }

    private String sanitizeChannelName(String input) {
        return input.toLowerCase()
            .replaceAll("[^a-z0-9-]", "-")
            .replaceAll("-{2,}", "-")
            .replaceAll("^-|-$", "");
    }

    private boolean isValidAccountType(String accountType) {
        return "premium".equalsIgnoreCase(accountType) || "cracked".equalsIgnoreCase(accountType);
    }

    private void loadWaitlistCooldowns() {
        if (!waitlistFile.exists()) {
            return;
        }

        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(waitlistFile);
        loadCooldownSection(yaml, "cooldowns", waitlistCooldowns);
        loadCooldownSection(yaml, "test-cooldowns", testCooldowns);
    }

    private void saveWaitlistCooldowns() {
        YamlConfiguration yaml = new YamlConfiguration();
        saveCooldownSection(yaml, "cooldowns", waitlistCooldowns);
        saveCooldownSection(yaml, "test-cooldowns", testCooldowns);
        try {
            yaml.save(waitlistFile);
        } catch (IOException exception) {
            plugin.getLogger().warning("Failed to save waitlist.yml: " + exception.getMessage());
        }
    }

    private void loadCooldownSection(YamlConfiguration yaml, String sectionPath, ConcurrentMap<String, Long> target) {
        ConfigurationSection section = yaml.getConfigurationSection(sectionPath);
        if (section == null) return;
        for (String key : section.getKeys(false)) {
            long timestamp = section.getLong(key, 0L);
            if (timestamp > 0L) {
                target.put(key, timestamp);
            }
        }
    }

    private void saveCooldownSection(YamlConfiguration yaml, String sectionPath, ConcurrentMap<String, Long> source) {
        for (Map.Entry<String, Long> entry : source.entrySet()) {
            yaml.set(sectionPath + "." + entry.getKey(), entry.getValue());
        }
    }

    public long getRemainingTestCooldownDays(long userId, String gamemodeKey) {
        if (gamemodeKey == null || gamemodeKey.isBlank()) return 0L;

        long cooldownDays = plugin.getConfig().getLong("waitlist-cooldown-days", 5L);
        long cooldownMillis = ChronoUnit.DAYS.getDuration().toMillis() * Math.max(0L, cooldownDays);
        if (cooldownMillis <= 0L) return 0L;

        String key = userId + ":" + gamemodeKey.trim().toLowerCase();
        Long lastCompletedAt = testCooldowns.get(key);
        if (lastCompletedAt == null) return 0L;

        long now = System.currentTimeMillis();
        long elapsed = now - lastCompletedAt;
        if (elapsed < 0L || elapsed >= cooldownMillis) return 0L;

        long remainingMillis = cooldownMillis - elapsed;
        return Math.max(1L, (long) Math.ceil(remainingMillis / (double) ChronoUnit.DAYS.getDuration().toMillis()));
    }

    public void markTestCompleted(long userId, String gamemodeKey) {
        if (gamemodeKey == null || gamemodeKey.isBlank()) return;
        String key = userId + ":" + gamemodeKey.trim().toLowerCase();
        testCooldowns.put(key, System.currentTimeMillis());
        saveWaitlistCooldowns();
    }

    private void loadProfiles() {
        if (!registrationsFile.exists()) {
            return;
        }

        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(registrationsFile);
        ConfigurationSection profilesSection = yaml.getConfigurationSection("profiles");
        if (profilesSection == null) {
            return;
        }

        for (String key : profilesSection.getKeys(false)) {
            ConfigurationSection section = profilesSection.getConfigurationSection(key);
            if (section == null) {
                continue;
            }

            try {
                long userId = Long.parseLong(key);
                String ign = section.getString("ign", "").trim();
                String accountType = section.getString("account-type", "Premium").trim();
                String preferredServer = section.getString("preferred-server", "").trim();
                String gameMode = section.getString("gamemode", "").trim();
                String skinUrl = section.getString("skin-url", "").trim();
                long updatedAtMillis = section.getLong("updated-at", System.currentTimeMillis());
                if (ign.isBlank()) {
                    continue;
                }

                profiles.put(userId, new RegistrationProfile(
                    userId, ign, accountType, preferredServer, gameMode, skinUrl,
                    Instant.ofEpochMilli(updatedAtMillis)
                ));
            } catch (NumberFormatException ignored) {
            }
        }
    }

    private void saveProfiles() {
        YamlConfiguration yaml = new YamlConfiguration();
        for (RegistrationProfile profile : profiles.values()) {
            String path = "profiles." + profile.userId();
            yaml.set(path + ".ign", profile.ign());
            yaml.set(path + ".account-type", profile.accountType());
            yaml.set(path + ".preferred-server", profile.preferredServer());
            yaml.set(path + ".gamemode", profile.gameMode());
            yaml.set(path + ".skin-url", profile.skinUrl());
            yaml.set(path + ".updated-at", profile.updatedAt().toEpochMilli());
        }

        try {
            yaml.save(registrationsFile);
        } catch (IOException exception) {
            plugin.getLogger().warning("Failed to save registrations.yml: " + exception.getMessage());
        }
    }

    /**
     * Reset gamemode cooldown for a user (owner only)
     * @return true if cooldown was reset, false if no cooldown existed
     */
    public boolean resetGamemodeCooldown(long userId) {
        GamemodeSelection removed = gamemodeCooldowns.remove(userId);
        return removed != null;
    }

    private record GamemodeSelection(String gamemode, long timestamp) {}
}
