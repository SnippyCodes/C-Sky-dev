package com.example.discordqueuebot.manager;

import com.example.discordqueuebot.DiscordQueuePlugin;
import com.example.discordqueuebot.model.RegistrationProfile;
import java.awt.Color;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import net.dv8tion.jda.api.EmbedBuilder;
import net.dv8tion.jda.api.Permission;
import net.dv8tion.jda.api.entities.Guild;
import net.dv8tion.jda.api.entities.Member;
import net.dv8tion.jda.api.entities.Role;
import net.dv8tion.jda.api.entities.User;
import net.dv8tion.jda.api.entities.channel.concrete.Category;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.entities.emoji.Emoji;
import net.dv8tion.jda.api.events.interaction.command.SlashCommandInteractionEvent;
import net.dv8tion.jda.api.events.interaction.component.ButtonInteractionEvent;
import net.dv8tion.jda.api.components.actionrow.ActionRow;
import net.dv8tion.jda.api.components.buttons.Button;

public final class WaitlistQueueManager {

    private static final String BTN_JOIN = "wl_join";
    private static final String BTN_LEAVE = "wl_leave";
    private static final String BTN_NEXT = "wl_next";
    private static final String BTN_END = "wl_end";
    public static final String TICKET_RESULT_PREFIX = "ticket_result:";

    private static final EnumSet<Permission> TEST_CHANNEL_ALLOWED = EnumSet.of(
        Permission.VIEW_CHANNEL,
        Permission.MESSAGE_SEND,
        Permission.MESSAGE_HISTORY,
        Permission.MESSAGE_ATTACH_FILES,
        Permission.MESSAGE_EMBED_LINKS
    );

    private final DiscordQueuePlugin plugin;
    private final RegistrationManager registrationManager;
    private final TierLeaderboardManager tierLeaderboardManager;
    private final RestrictionManager restrictionManager;

    // channelId -> TicketInfo
    private final ConcurrentMap<Long, TicketInfo> ticketInfoMap = new ConcurrentHashMap<>();

    // gamemodeKey -> (userId -> entry) in join order
    private final ConcurrentMap<String, LinkedHashMap<Long, QueueEntry>> queues = new ConcurrentHashMap<>();
    // gamemodeKey -> active?
    private final ConcurrentMap<String, Boolean> active = new ConcurrentHashMap<>();
    // gamemodeKey -> queue message id in its waitlist channel
    private final ConcurrentMap<String, Long> queueMessageIds = new ConcurrentHashMap<>();
    // gamemodeKey -> last close reason
    private final ConcurrentMap<String, String> lastCloseReasons = new ConcurrentHashMap<>();
    // gamemodeKey -> last close timestamp
    private final ConcurrentMap<String, Instant> lastClosedAt = new ConcurrentHashMap<>();
    // gamemodeKey -> tester who started the queue
    private final ConcurrentMap<String, Long> queueStarters = new ConcurrentHashMap<>();

    private static final DateTimeFormatter CLOSED_TIME_FORMAT =
        DateTimeFormatter.ofPattern("d MMMM uuuu 'at' h:mm a").withZone(ZoneId.systemDefault());

    public WaitlistQueueManager(DiscordQueuePlugin plugin, RegistrationManager registrationManager, TierLeaderboardManager tierLeaderboardManager, RestrictionManager restrictionManager) {
        this.plugin = plugin;
        this.registrationManager = registrationManager;
        this.tierLeaderboardManager = tierLeaderboardManager;
        this.restrictionManager = restrictionManager;
    }

    public void handleStart(SlashCommandInteractionEvent event) {
        if (!isGuildContext(event)) return;
        if (!isTester(event)) {
            event.reply("⛔ Only testers can start the waitlist.").setEphemeral(true).queue();
            return;
        }

        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.reply("⚠️ Use this command inside a configured waitlist channel.").setEphemeral(true).queue();
            return;
        }

        active.put(gamemodeKey, true);
        lastCloseReasons.remove(gamemodeKey);
        queueMessageIds.remove(gamemodeKey);
        queueStarters.put(gamemodeKey, event.getUser().getIdLong());

        TextChannel channel = (TextChannel) event.getChannel();
        long selfId = event.getJDA().getSelfUser().getIdLong();

        Runnable sendQueue = () -> ensureQueueMessage(event.getGuild(), gamemodeKey, channel, true);

        // Best-effort cleanup of bot messages; always send queue even if history fetch/delete fails (missing perms, etc.)
        if (!event.getGuild().getSelfMember().hasPermission(channel, Permission.MESSAGE_HISTORY)) {
            sendQueue.run();
        } else {
            channel.getIterableHistory().takeAsync(100).whenComplete((messages, error) -> {
                if (error != null || messages == null) {
                    sendQueue.run();
                    return;
                }

                List<net.dv8tion.jda.api.entities.Message> toDelete = messages.stream()
                    .filter(m -> m.getAuthor().getIdLong() == selfId)
                    .toList();

                if (toDelete.isEmpty()) {
                    sendQueue.run();
                } else if (toDelete.size() == 1) {
                    toDelete.get(0).delete().queue(s -> sendQueue.run(), e -> sendQueue.run());
                } else {
                    channel.deleteMessages(toDelete).queue(s -> sendQueue.run(), e -> sendQueue.run());
                }
            });
        }

        event.reply("✅ Waitlist started for **" + prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
    }

    public void handleStop(SlashCommandInteractionEvent event) {
        if (!isGuildContext(event)) return;
        if (!isTester(event)) {
            event.reply("⛔ Only testers can stop the waitlist.").setEphemeral(true).queue();
            return;
        }

        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.reply("⚠️ Use this command inside a configured waitlist channel.").setEphemeral(true).queue();
            return;
        }

        active.remove(gamemodeKey);
        lastCloseReasons.put(gamemodeKey, "Queue manually ended by command");
        lastClosedAt.put(gamemodeKey, Instant.now());
        queueStarters.remove(gamemodeKey);

        purgeBotMessagesAndResendQueue(event.getChannel().asTextChannel(), gamemodeKey);
        event.reply("🛑 Waitlist stopped for **" + prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
    }

    public void handleNext(SlashCommandInteractionEvent event) {
        if (!isGuildContext(event)) return;
        if (!isTester(event)) {
            event.reply("⛔ Only testers can run next.").setEphemeral(true).queue();
            return;
        }

        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.reply("⚠️ Use this command inside a configured waitlist channel.").setEphemeral(true).queue();
            return;
        }
        if (!Boolean.TRUE.equals(active.get(gamemodeKey))) {
            event.reply("🔒 Queue is closed. Use `/waitlist start` first.").setEphemeral(true).queue();
            return;
        }

        QueueEntry next = pollNext(gamemodeKey);
        if (next == null) {
            event.reply("📭 Queue is empty.").setEphemeral(true).queue();
            return;
        }

        updateQueueMessage(event.getGuild(), gamemodeKey);
        createTestChannelFor(event.getGuild(), gamemodeKey, next, event.getMember(), result -> {
            if (result == null) {
                event.reply("❌ Failed to create test channel.").setEphemeral(true).queue();
                return;
            }
            event.reply("🎯 Next player: " + next.userMention() + " → " + result.getAsMention()).setEphemeral(true).queue();
        });
    }

    public void handleCloseTicket(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("⚠️ This command can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        if (!isTester(event.getGuild(), event.getMember())) {
            event.reply("⛔ Only testers can close tickets.").setEphemeral(true).queue();
            return;
        }

        long channelId = event.getChannel().getIdLong();
        TicketInfo info = ticketInfoMap.remove(channelId);
        
        if (info == null) {
            event.reply("⚠️ This is not a test ticket channel.").setEphemeral(true).queue();
            return;
        }

        event.reply("✅ Ticket closed without tier assignment. Channel will be deleted in 5 seconds...")
            .queue(hook -> {
                // Log closure
                logTicketClosure(event.getChannel().asTextChannel(), info, event.getUser(), "Closed without tier");
                registrationManager.markTestCompleted(info.playerUserId(), info.gamemodeKey());
                event.getChannel().delete().queueAfter(5, java.util.concurrent.TimeUnit.SECONDS);
            });
    }

    public void handleButton(ButtonInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("⚠️ This can only be used in a server.").setEphemeral(true).queue();
            return;
        }

        String id = event.getComponentId();
        if (BTN_JOIN.equals(id)) {
            handleJoin(event);
            return;
        }
        if (BTN_LEAVE.equals(id)) {
            handleLeave(event);
            return;
        }
        if (BTN_NEXT.equals(id)) {
            event.deferReply(true).queue(
                hook -> handleNextFromButton(event),
                failure -> event.reply("❌ Couldn't acknowledge the button interaction. Please try again.")
                    .setEphemeral(true)
                    .queue()
            );
            return;
        }
        if (BTN_END.equals(id)) {
            handleEnd(event);
            return;
        }
        if (id != null && id.startsWith(TICKET_RESULT_PREFIX)) {
            handleTicketResult(event, id.substring(TICKET_RESULT_PREFIX.length()));
        }
    }

    private void handleJoin(ButtonInteractionEvent event) {
        event.deferReply(true).queue();

        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.getHook().sendMessage("⚠️ Join is only available in a waitlist channel.").queue();
            return;
        }

        if (!Boolean.TRUE.equals(active.get(gamemodeKey))) {
            event.getHook().sendMessage("🔒 Queue is closed right now.").queue();
            return;
        }

        if (restrictionManager != null && restrictionManager.isRestricted(event.getUser().getIdLong())) {
            event.getHook().sendMessage("⛔ You are restricted from using the waitlist.").queue();
            return;
        }

        if (!hasWaitlistRole(event.getGuild(), event.getMember(), gamemodeKey)) {
            event.getHook().sendMessage("🧾 You don't have the waitlist role for this gamemode. Select it from the register panel first.").queue();
            return;
        }

        RegistrationProfile profile = registrationManager.getProfile(event.getUser().getIdLong());
        if (profile == null) {
            event.getHook().sendMessage("📝 Register your profile first.").queue();
            return;
        }

        if (isBeingTested(event.getUser().getIdLong())) {
            event.getHook().sendMessage("⚠️ You are already being tested.").queue();
            return;
        }

        // Allow re-testing immediately if the player is re-joining the same gamemode they selected from the register panel.
        if (profile.gameMode() == null || !profile.gameMode().trim().equalsIgnoreCase(gamemodeKey)) {
            long remainingCooldownDays = registrationManager.getRemainingTestCooldownDays(event.getUser().getIdLong(), gamemodeKey);
            if (remainingCooldownDays > 0L) {
                event.getHook().sendMessage("\u23F3 You are on cooldown for **" + prettyGamemode(gamemodeKey) + "**.\n\ud83d\uddd3\ufe0f Cooldown ends in **" + remainingCooldownDays + " day(s)**.")
                    .queue();
                return;
            }
        }

        LinkedHashMap<Long, QueueEntry> queue = queues.computeIfAbsent(gamemodeKey, ignored -> new LinkedHashMap<>());
        synchronized (queue) {
            if (queue.containsKey(event.getUser().getIdLong())) {
                event.getHook().sendMessage("✅ You're already in the queue.").queue();
                return;
            }
            queue.put(event.getUser().getIdLong(), new QueueEntry(event.getUser().getIdLong(), profile.ign(), Instant.now().toEpochMilli()));
        }

        updateQueueMessage(event.getGuild(), gamemodeKey);
        event.getHook().sendMessage("🎟️ Joined the queue for **" + prettyGamemode(gamemodeKey) + "**.").queue();
    }

    private void handleLeave(ButtonInteractionEvent event) {
        event.deferReply(true).queue();

        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.getHook().sendMessage("⚠️ Leave is only available in a waitlist channel.").queue();
            return;
        }

        LinkedHashMap<Long, QueueEntry> queue = queues.get(gamemodeKey);
        if (queue == null) {
            event.getHook().sendMessage("📭 Queue is empty.").queue();
            return;
        }

        boolean removed;
        synchronized (queue) {
            removed = queue.remove(event.getUser().getIdLong()) != null;
        }

        if (!removed) {
            event.getHook().sendMessage("ℹ️ You're not in the queue.").queue();
            return;
        }

        updateQueueMessage(event.getGuild(), gamemodeKey);
        event.getHook().sendMessage("👋 Left the queue.").queue();
    }

    private void handleNextFromButton(ButtonInteractionEvent event) {
        try {
        if (!isTester(event.getGuild(), event.getMember())) {
            event.getHook().sendMessage("⛔ Only testers can run next.").queue();
            return;
        }

        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.getHook().sendMessage("⚠️ Use this inside a waitlist channel.").queue();
            return;
        }

        Long starterId = queueStarters.get(gamemodeKey);
        if (starterId != null && starterId != event.getUser().getIdLong()) {
            event.getHook().sendMessage("⛔ Only the tester who started this queue can use **Next**.").queue();
            return;
        }

        if (!Boolean.TRUE.equals(active.get(gamemodeKey))) {
            event.getHook().sendMessage("🔒 Queue is closed. Use `/waitlist start` first.").queue();
            return;
        }

        QueueEntry next = pollNext(gamemodeKey);
        if (next == null) {
            event.getHook().sendMessage("📭 Queue is empty.").queue();
            return;
        }

        updateQueueMessage(event.getGuild(), gamemodeKey);
        createTestChannelFor(event.getGuild(), gamemodeKey, next, event.getMember(), channel -> {
            if (channel == null) {
                event.getHook().sendMessage("❌ Failed to create test channel.").queue();
                return;
            }
            event.getHook().sendMessage("🎯 Next player: " + next.userMention() + " → " + channel.getAsMention()).queue();
        });
        } catch (RuntimeException exception) {
            plugin.getLogger().log(java.util.logging.Level.WARNING, "[Waitlist] Next failed", exception);
            String msg = exception.getMessage() == null ? "" : (": " + exception.getMessage());
            event.getHook().sendMessage("❌ Next failed (" + exception.getClass().getSimpleName() + msg + ").").queue();
        }
    }

    private void handleEnd(ButtonInteractionEvent event) {
        if (!isTester(event.getGuild(), event.getMember())) {
            event.reply("⛔ Only testers can end the waitlist.").setEphemeral(true).queue();
            return;
        }
        String gamemodeKey = resolveGamemodeKeyFromChannel(event.getGuild(), event.getChannel().getIdLong());
        if (gamemodeKey == null) {
            event.reply("⚠️ Use this inside a waitlist channel.").setEphemeral(true).queue();
            return;
        }

        Long starterId = queueStarters.get(gamemodeKey);
        if (starterId != null && starterId != event.getUser().getIdLong()) {
            event.reply("⛔ Only the tester who started this queue can use **Close**.").setEphemeral(true).queue();
            return;
        }

        Instant endedAt = Instant.now();
        active.remove(gamemodeKey);
        lastCloseReasons.put(gamemodeKey, "Queue manually ended by tester");
        lastClosedAt.put(gamemodeKey, endedAt);
        queueStarters.remove(gamemodeKey);

        purgeBotMessagesAndResendQueue(event.getChannel().asTextChannel(), gamemodeKey);

        event.reply("🔒 Queue closed for **" + prettyGamemode(gamemodeKey) + "**.").setEphemeral(true).queue();
    }

    private void purgeBotMessagesAndResendQueue(TextChannel channel, String gamemodeKey) {
        if (channel == null) return;

        long selfId = channel.getJDA().getSelfUser().getIdLong();
        channel.getIterableHistory().takeAsync(100).whenComplete((messages, error) -> {
            if (error != null || messages == null) {
                queueMessageIds.remove(gamemodeKey);
                updateQueueMessage(channel.getGuild(), gamemodeKey, channel, false);
                return;
            }

            List<net.dv8tion.jda.api.entities.Message> toDelete = messages.stream()
                .filter(m -> m.getAuthor().getIdLong() == selfId)
                .toList();

            Runnable sendClosed = () -> {
                queueMessageIds.remove(gamemodeKey);
                updateQueueMessage(channel.getGuild(), gamemodeKey, channel, false);
            };

            if (toDelete.isEmpty()) {
                sendClosed.run();
                return;
            }

            if (toDelete.size() == 1) {
                toDelete.get(0).delete().queue(
                    success -> sendClosed.run(),
                    failure -> sendClosed.run()
                );
                return;
            }

            // Bulk delete can fail for older messages; fall back to deleting individually.
            channel.deleteMessages(toDelete).queue(
                success -> sendClosed.run(),
                failure -> {
                    var remaining = new java.util.concurrent.atomic.AtomicInteger(toDelete.size());
                    for (var msg : toDelete) {
                        msg.delete().queue(
                            ok -> { if (remaining.decrementAndGet() == 0) sendClosed.run(); },
                            err -> { if (remaining.decrementAndGet() == 0) sendClosed.run(); }
                        );
                    }
                }
            );
        });
    }

    private QueueEntry pollNext(String gamemodeKey) {
        LinkedHashMap<Long, QueueEntry> queue = queues.get(gamemodeKey);
        if (queue == null) return null;
        synchronized (queue) {
            var it = queue.entrySet().iterator();
            if (!it.hasNext()) return null;
            Map.Entry<Long, QueueEntry> entry = it.next();
            it.remove();
            return entry.getValue();
        }
    }

    private void ensureQueueMessage(Guild guild, String gamemodeKey, TextChannel channel, boolean includeHerePing) {
        queueMessageIds.putIfAbsent(gamemodeKey, 0L);
        updateQueueMessage(guild, gamemodeKey, channel, includeHerePing);
    }

    private void updateQueueMessage(Guild guild, String gamemodeKey) {
        TextChannel channel = resolveWaitlistChannel(guild, gamemodeKey);
        if (channel == null) return;
        updateQueueMessage(guild, gamemodeKey, channel, false);
    }

    private void updateQueueMessage(Guild guild, String gamemodeKey, TextChannel channel, boolean includeHerePing) {
        long messageId = queueMessageIds.getOrDefault(gamemodeKey, 0L);
        var embed = buildQueueEmbed(gamemodeKey);
        var rows = buildQueueControls(gamemodeKey, Boolean.TRUE.equals(active.get(gamemodeKey)));
        String content = buildQueueMessageContent(gamemodeKey, includeHerePing);

        if (messageId != 0L) {
            if (content == null || content.isBlank()) {
                channel.editMessageEmbedsById(messageId, embed)
                    .setComponents(rows)
                    .queue(
                        success -> {
                        },
                        failure -> sendNewQueueMessage(channel, gamemodeKey, "", embed, rows)
                    );
            } else {
                channel.editMessageById(messageId, content)
                    .setEmbeds(embed)
                    .setComponents(rows)
                    .queue(
                        success -> {
                        },
                        failure -> sendNewQueueMessage(channel, gamemodeKey, content, embed, rows)
                    );
            }
            return;
        }

        sendNewQueueMessage(channel, gamemodeKey, content, embed, rows);
    }

    private void sendNewQueueMessage(TextChannel channel, String gamemodeKey, String content, net.dv8tion.jda.api.entities.MessageEmbed embed, List<ActionRow> rows) {
        if (content == null || content.isBlank()) {
            channel.sendMessageEmbeds(embed)
                .setComponents(rows)
                .queue(message -> queueMessageIds.put(gamemodeKey, message.getIdLong()));
        } else {
            channel.sendMessage(content)
                .setEmbeds(embed)
                .setComponents(rows)
                .queue(message -> queueMessageIds.put(gamemodeKey, message.getIdLong()));
        }
    }

    private String buildQueueMessageContent(String gamemodeKey, boolean includeHerePing) {
        if (!includeHerePing) return "";
        return "@here **" + prettyGamemode(gamemodeKey) + "** queue is now open.";
    }

    private net.dv8tion.jda.api.entities.MessageEmbed buildQueueEmbed(String gamemodeKey) {
        if (!Boolean.TRUE.equals(active.get(gamemodeKey))) {
            String reason = lastCloseReasons.getOrDefault(gamemodeKey, "Queue is currently closed.");
            Instant endedAt = lastClosedAt.getOrDefault(gamemodeKey, Instant.now());
            return new EmbedBuilder()
                .setTitle("🔒 " + prettyGamemode(gamemodeKey) + " Queue Closed")
                .setColor(new Color(231, 76, 60))
                .setDescription("This testing session has ended. You will be notified here when a new queue opens.")
                .addField("📋 Reason", reason, false)
                .addField("⏰ Session Ended", CLOSED_TIME_FORMAT.format(endedAt), false)
                .setFooter("Thank you for testing!")
                .setTimestamp(endedAt)
                .build();
        }

        LinkedHashMap<Long, QueueEntry> queue = queues.getOrDefault(gamemodeKey, new LinkedHashMap<>());
        List<QueueEntry> entries;
        synchronized (queue) {
            entries = new ArrayList<>(queue.values());
        }

        Long testerId = queueStarters.get(gamemodeKey);
        String testerName = testerId == null ? "Unknown" : "<@" + testerId + ">";

        StringBuilder queueList = new StringBuilder();
        if (entries.isEmpty()) {
            queueList.append("No one yet — be the first to join!");
        } else {
            int i = 1;
            for (QueueEntry entry : entries.stream().limit(35).toList()) {
                queueList.append(i++).append(". <@").append(entry.userId()).append(">\n");
            }
        }
        String queueValue = clampEmbedFieldValue(queueList.toString(), 1024);

        String lastRefresh = DateTimeFormatter
            .ofPattern("h:mm:ss a")
            .withZone(ZoneId.of("Asia/Kolkata"))
            .format(Instant.now());
        
        return new EmbedBuilder()
            .setTitle("✅ " + prettyGamemode(gamemodeKey) + " Tester Available!")
            .setColor(new Color(46, 204, 113))
            .setDescription("The queue is now open and updates in real-time.")
            .setTimestamp(Instant.now())
            .addField("📋 Queue", queueValue, false)
            .addField("🧑‍💻 Active Tester", testerName, false)
            .addField("🕒 Last Refresh", lastRefresh, true)
            .setFooter("PrimeTiers Queue")
            .build();
    }

    private static String clampEmbedFieldValue(String value, int max) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (trimmed.length() <= max) return trimmed;
        if (max <= 3) return trimmed.substring(0, max);
        return trimmed.substring(0, max - 3).trim() + "...";
    }

    private List<ActionRow> buildQueueControls(String gamemodeKey, boolean isActive) {
        Button join = Button.success(BTN_JOIN, "Join").withEmoji(Emoji.fromUnicode("✅"));
        Button leave = Button.secondary(BTN_LEAVE, "Leave").withEmoji(Emoji.fromUnicode("🚪"));
        Button next = Button.primary(BTN_NEXT, "Next").withEmoji(Emoji.fromUnicode("⏭️"));
        Button end = Button.danger(BTN_END, "Close").withEmoji(Emoji.fromUnicode("🔒"));

        if (!isActive) {
            join = join.asDisabled();
            leave = leave.asDisabled();
            next = next.asDisabled();
            end = end.asDisabled();
        }

        return List.of(ActionRow.of(join, leave, next, end));
    }

    private void createTestChannelFor(Guild guild, String gamemodeKey, QueueEntry entry, Member testerMember, java.util.function.Consumer<TextChannel> callback) {
        var callbackSent = new java.util.concurrent.atomic.AtomicBoolean(false);
        java.util.function.Consumer<TextChannel> safeCallback = channel -> {
            if (callbackSent.compareAndSet(false, true)) {
                callback.accept(channel);
            }
        };

        try {
            long categoryId = plugin.getConfig().getLong("ticket-categories." + gamemodeKey, 0L);
            if (categoryId <= 0L) {
                safeCallback.accept(null);
                return;
            }
            Category category = guild.getCategoryById(categoryId);
            if (category == null) {
                safeCallback.accept(null);
                return;
            }

        guild.retrieveMemberById(entry.userId()).queue(playerMember -> {
            String channelName = sanitizeChannelName("test-" + gamemodeKey + "-" + (entry.ign() == null ? playerMember.getUser().getName() : entry.ign()));
            var action = category.createTextChannel(channelName)
                .addPermissionOverride(guild.getPublicRole(), null, EnumSet.of(Permission.VIEW_CHANNEL))
                .addPermissionOverride(playerMember, TEST_CHANNEL_ALLOWED, null)
                .addPermissionOverride(testerMember, TEST_CHANNEL_ALLOWED, null);

            long testerRoleId = plugin.getConfig().getLong("tester-role-id", 0L);
            if (testerRoleId > 0L) {
                Role testerRole = guild.getRoleById(testerRoleId);
                if (testerRole != null) {
                    action = action.addPermissionOverride(testerRole, TEST_CHANNEL_ALLOWED, null);
                }
            }

            action.queue(channel -> {
                ticketInfoMap.put(channel.getIdLong(), new TicketInfo(gamemodeKey, entry.userId(), entry.ign()));
                
                // Send test started embed
                RegistrationProfile profile = registrationManager.getProfile(entry.userId());
                EmbedBuilder testStartEmbed = new EmbedBuilder()
                    .setTitle("Test Started")
                    .setColor(new Color(46, 204, 113))
                    .addField("Tester(s)", testerMember.getAsMention(), false)
                    .addField("Player", playerMember.getAsMention(), false)
                    .addField("IGN", entry.ign() != null ? entry.ign() : "Unknown", true)
                    .addField("Type", profile != null ? profile.accountType() : "Unknown", true)
                    .addField("Preferred Server", profile != null && profile.preferredServer() != null && !profile.preferredServer().isBlank() ? profile.preferredServer() : "Not specified", false)
                    .setFooter("PrimeTiers 🔥")
                    .setTimestamp(Instant.now());
                
                channel.sendMessageEmbeds(testStartEmbed.build()).queue();
                
                // Send tier selection buttons
                String prettyGm = shortGamemodeLabel(gamemodeKey);
                List<Button> tierButtons = new ArrayList<>();
                for (String tier : TierLeaderboardManager.TIER_ORDER) {
                    // button id = prefix + tier only, label shows gamemode prefix
                    tierButtons.add(Button.secondary(TICKET_RESULT_PREFIX + tier, prettyGm + " " + tier));
                }
                List<ActionRow> rows = new ArrayList<>();
                rows.add(ActionRow.of(tierButtons.subList(0, 5)));
                rows.add(ActionRow.of(tierButtons.subList(5, tierButtons.size())));
                channel.sendMessage(playerMember.getAsMention() + " 🧑‍💻 Tester: " + testerMember.getAsMention() + "\n\n🎯 **Select the result tier below:**")
                    .setComponents(rows)
                    .queue();
                safeCallback.accept(channel);
            }, failure -> safeCallback.accept(null));
        }, failure -> safeCallback.accept(null));
        } catch (RuntimeException exception) {
            plugin.getLogger().warning("[Waitlist] Failed to create test channel: " + exception.getMessage());
            try {
                safeCallback.accept(null);
            } catch (RuntimeException ignored) {
            }
        }
    }

    private TextChannel resolveWaitlistChannel(Guild guild, String gamemodeKey) {
        long channelId = plugin.getConfig().getLong("waitlist-channels." + gamemodeKey, 0L);
        if (channelId <= 0L) return null;
        return guild.getTextChannelById(channelId);
    }

    private String resolveGamemodeKeyFromChannel(Guild guild, long channelId) {
        var section = plugin.getConfig().getConfigurationSection("waitlist-channels");
        if (section == null) return null;
        for (String key : section.getKeys(false)) {
            if (plugin.getConfig().getLong("waitlist-channels." + key, 0L) == channelId) {
                return key;
            }
        }
        return null;
    }

    private boolean isTester(SlashCommandInteractionEvent event) {
        return isTester(event.getGuild(), event.getMember());
    }

    private boolean isTester(Guild guild, Member member) {
        long testerRoleId = plugin.getConfig().getLong("tester-role-id", 0L);
        if (testerRoleId > 0L) {
            Role role = guild.getRoleById(testerRoleId);
            return role != null && member.getRoles().contains(role);
        }
        return member.hasPermission(Permission.MESSAGE_MANAGE);
    }

    private boolean hasWaitlistRole(Guild guild, Member member, String gamemodeKey) {
        long roleId = plugin.getConfig().getLong("waitlist-roles." + gamemodeKey, 0L);
        if (roleId <= 0L) return true; // allow if not configured
        Role role = guild.getRoleById(roleId);
        return role != null && member.getRoles().contains(role);
    }

    private boolean isGuildContext(SlashCommandInteractionEvent event) {
        if (!event.isFromGuild() || event.getGuild() == null || event.getMember() == null) {
            event.reply("⚠️ This command can only be used in a server channel.").setEphemeral(true).queue();
            return false;
        }
        if (!(event.getChannel() instanceof TextChannel)) {
            event.reply("⚠️ Use this command in a text channel.").setEphemeral(true).queue();
            return false;
        }
        return true;
    }

    private String prettyGamemode(String key) {
        return switch (key) {
            case "axe-and-shield" -> "Axe & Shield";
            case "neth-pot" -> "Neth Pot";
            case "dia-pot" -> "Dia Pot";
            case "smp-kit" -> "SMP Kit";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> key;
        };
    }

    private String shortGamemodeLabel(String key) {
        return switch (key) {
            case "axe-and-shield" -> "Axe";
            case "neth-pot" -> "Neth";
            case "dia-pot" -> "Dia";
            case "smp-kit" -> "SMP";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> key;
        };
    }

    private String tierToFullName(String tier) {
        return switch (tier) {
            case "HT1" -> "High Tier 1";
            case "LT1" -> "Low Tier 1";
            case "HT2" -> "High Tier 2";
            case "LT2" -> "Low Tier 2";
            case "HT3" -> "High Tier 3";
            case "LT3" -> "Low Tier 3";
            case "HT4" -> "High Tier 4";
            case "LT4" -> "Low Tier 4";
            case "HT5" -> "High Tier 5";
            case "LT5" -> "Low Tier 5";
            default -> tier;
        };
    }

    private String sanitizeChannelName(String input) {
        return input.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9-]", "-")
            .replaceAll("-{2,}", "-")
            .replaceAll("^-|-$", "");
    }

    private record QueueEntry(long userId, String ign, long joinedAtMillis) {
        String userMention() {
            return "<@" + userId + ">";
        }
    }

    private record TicketInfo(String gamemodeKey, long playerUserId, String ign) {}

    private boolean isBeingTested(long userId) {
        return ticketInfoMap.values().stream().anyMatch(info -> info.playerUserId() == userId);
    }

    public void handleTicketResult(ButtonInteractionEvent event, String rawTier) {
        // Defer reply immediately to avoid timeout
        event.deferReply(true).queue();
        
        // rawTier is exactly the tier code (HT1, LT1, etc.) from button id
        String tier = rawTier.trim().toUpperCase(java.util.Locale.ROOT);
        if (!isTester(event.getGuild(), event.getMember())) {
            event.getHook().sendMessage("⛔ Only testers can submit results.").queue();
            return;
        }

        long channelId = event.getChannel().getIdLong();
        TicketInfo info = ticketInfoMap.remove(channelId);
        if (info == null) {
            event.getHook().sendMessage("⚠️ No ticket info found for this channel.").queue();
            return;
        }

        String previousTier = tierLeaderboardManager.getPreviousTier(info.playerUserId(), info.gamemodeKey());
        tierLeaderboardManager.upsertTier(info.playerUserId(), info.gamemodeKey(), tier, info.ign(), event.getUser().getIdLong());
        registrationManager.markTestCompleted(info.playerUserId(), info.gamemodeKey());

        // Update Discord roles (remove old tier role, add new tier role)
        updateDiscordTierRoles(event.getGuild(), info.playerUserId(), info.gamemodeKey(), previousTier, tier);

        long resultChannelId = plugin.getConfig().getLong("result-channel-id", 0L);
        if (resultChannelId > 0L) {
            TextChannel resultChannel = event.getGuild().getTextChannelById(resultChannelId);
            if (resultChannel != null) {
                String playerName = info.ign() != null && !info.ign().isBlank() ? info.ign() : "Unknown";
                String previousRank = previousTier != null ? tierToFullName(previousTier) : "Unranked";
                String rankEarned = tierToFullName(tier);
                RegistrationProfile profile = registrationManager.getProfile(info.playerUserId());
                String skinUrl;
                if (profile != null && "cracked".equalsIgnoreCase(profile.accountType()) && profile.skinUrl() != null && !profile.skinUrl().isBlank()) {
                    skinUrl = profile.skinUrl();
                } else {
                    skinUrl = "https://visage.surgeplay.com/bust/" + playerName + "?overlay";
                }
                
                EmbedBuilder embed = new EmbedBuilder()
                    .setAuthor(playerName + "'s Tier Update 🏆")
                    .setColor(new Color(241, 196, 15))
                    .setThumbnail(skinUrl)
                    .addField("Tester", event.getUser().getAsMention(), false)
                    .addField("Minecraft Username", "`" + playerName + "`", false)
                    .addField("Game Mode", "`" + prettyGamemode(info.gamemodeKey()) + "`", false)
                    .addField("Previous Rank", "`" + previousRank + "`", false)
                    .addField("Rank Earned", "`" + rankEarned + "`", false)
                    .setFooter("PrimeTiers")
                    .setTimestamp(Instant.now());
                
                resultChannel.sendMessage("<@" + info.playerUserId() + ">")
                    .setEmbeds(embed.build())
                    .queue(msg -> {
                        msg.addReaction(net.dv8tion.jda.api.entities.emoji.Emoji.fromUnicode("🏆")).queue();
                        msg.addReaction(net.dv8tion.jda.api.entities.emoji.Emoji.fromUnicode("🎉")).queue();
                        msg.addReaction(net.dv8tion.jda.api.entities.emoji.Emoji.fromUnicode("🔥")).queue();
                        msg.addReaction(net.dv8tion.jda.api.entities.emoji.Emoji.fromUnicode("👍")).queue();
                        msg.addReaction(net.dv8tion.jda.api.entities.emoji.Emoji.fromUnicode("💀")).queue();
                        plugin.getLogger().info("[Result] " + playerName);
                        
                        // Assign LuckPerms group in Minecraft
                        if (plugin.getLuckPermsManager().isEnabled()) {
                            plugin.getLuckPermsManager().assignTierGroup(playerName, info.gamemodeKey(), tier);
                        }
                    }, e -> plugin.getLogger().warning("[Result] Error: " + e.getMessage()));
            }
        }
        event.getHook().sendMessage("✅ Result **" + tier + "** submitted for <@" + info.playerUserId() + ">. Channel closing...")
            .queue(hook -> {
                // Generate transcript before deleting channel
                generateTranscript(event.getChannel().asTextChannel(), info, tier, event.getUser());
                event.getChannel().delete().queueAfter(5, java.util.concurrent.TimeUnit.SECONDS);
            });
    }

    private void generateTranscript(TextChannel channel, TicketInfo info, String tier, User tester) {
        long logsChannelId = plugin.getConfig().getLong("logs-channel-id", 0L);
        if (logsChannelId <= 0L) return;

        TextChannel logsChannel = channel.getGuild().getTextChannelById(logsChannelId);
        if (logsChannel == null) return;

        // Fetch all messages from the ticket channel
        channel.getIterableHistory().takeAsync(100).thenAccept(messages -> {
            StringBuilder transcript = new StringBuilder();
            transcript.append("**Ticket Transcript**\n");
            transcript.append("Channel: ").append(channel.getName()).append("\n");
            transcript.append("Tester: ").append(tester.getAsTag()).append("\n");
            transcript.append("Player: <@").append(info.playerUserId()).append("> (").append(info.ign()).append(")\n");
            transcript.append("Gamemode: ").append(prettyGamemode(info.gamemodeKey())).append("\n");
            transcript.append("Result: ").append(tierToFullName(tier)).append("\n\n");
            transcript.append("--- Messages ---\n");

            // Reverse to show oldest first
            java.util.Collections.reverse(messages);
            for (var msg : messages) {
                String timestamp = msg.getTimeCreated().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"));
                transcript.append("[").append(timestamp).append("] ")
                    .append(msg.getAuthor().getAsTag()).append(": ")
                    .append(msg.getContentDisplay()).append("\n");
            }

            // Split transcript if too long (Discord limit 2000 chars per message)
            String fullTranscript = transcript.toString();
            if (fullTranscript.length() <= 2000) {
                logsChannel.sendMessage("```\n" + fullTranscript + "\n```").queue();
            } else {
                // Send in chunks
                int chunkSize = 1900;
                for (int i = 0; i < fullTranscript.length(); i += chunkSize) {
                    int end = Math.min(i + chunkSize, fullTranscript.length());
                    logsChannel.sendMessage("```\n" + fullTranscript.substring(i, end) + "\n```").queue();
                }
            }

            // Send ticket details embed
            logsChannel.sendMessageEmbeds(new EmbedBuilder()
                .setAuthor("Test Ticket Closed")
                .setColor(new Color(231, 76, 60))
                .addField("👨‍💻 Tester", tester.getAsMention(), true)
                .addField("🎮 Player", "<@" + info.playerUserId() + ">", true)
                .addField("🎮 IGN", info.ign(), true)
                .addField("🎮 Gamemode", prettyGamemode(info.gamemodeKey()), true)
                .addField("🏆 Result", tierToFullName(tier), true)
                .setFooter("PrimeTiers 🔥")
                .setTimestamp(Instant.now())
                .build())
            .queue();
        });
    }

    /**
     * Update Discord tier roles when a player's tier changes
     * Removes old tier role and adds new tier role
     */
    private void updateDiscordTierRoles(Guild guild, long userId, String gamemodeKey, String oldTier, String newTier) {
        guild.retrieveMemberById(userId).queue(member -> {
            // Remove old tier role if exists
            if (oldTier != null && !oldTier.isBlank()) {
                String oldRoleName = buildTierRoleName(gamemodeKey, oldTier);
                Role oldRole = guild.getRoles().stream()
                    .filter(r -> r.getName().equalsIgnoreCase(oldRoleName))
                    .findFirst()
                    .orElse(null);
                
                if (oldRole != null && member.getRoles().contains(oldRole)) {
                    guild.removeRoleFromMember(member, oldRole).queue(
                        success -> plugin.getLogger().info("Removed old tier role: " + oldRoleName + " from " + member.getUser().getName()),
                        error -> plugin.getLogger().warning("Failed to remove old tier role: " + error.getMessage())
                    );
                }
            }
            
            // Add new tier role
            String newRoleName = buildTierRoleName(gamemodeKey, newTier);
            Role newRole = guild.getRoles().stream()
                .filter(r -> r.getName().equalsIgnoreCase(newRoleName))
                .findFirst()
                .orElse(null);
            
            if (newRole != null) {
                guild.addRoleToMember(member, newRole).queue(
                    success -> plugin.getLogger().info("Added new tier role: " + newRoleName + " to " + member.getUser().getName()),
                    error -> plugin.getLogger().warning("Failed to add new tier role: " + error.getMessage())
                );
            } else {
                plugin.getLogger().warning("Tier role not found: " + newRoleName);
            }
        }, error -> plugin.getLogger().warning("Failed to retrieve member: " + error.getMessage()));
    }
    
    /**
     * Build tier role name from gamemode and tier
     * Format: [Axe-HT1], [NethPot-LT5], [SMP-HT3], etc.
     */
    private String buildTierRoleName(String gamemodeKey, String tier) {
        String gamemodePart = switch (gamemodeKey.toLowerCase()) {
            case "axe-and-shield" -> "Axe";
            case "neth-pot" -> "Neth";
            case "dia-pot" -> "Dia";
            case "smp-kit" -> "SMP";
            case "mace" -> "Mace";
            case "sword" -> "Sword";
            case "uhc" -> "UHC";
            case "cpvp" -> "CPvP";
            default -> gamemodeKey;
        };
        return "[" + gamemodePart + "-" + tier.toUpperCase() + "]";
    }

    /**
     * Log ticket closure without tier assignment
     */
    private void logTicketClosure(TextChannel channel, TicketInfo info, User tester, String reason) {
        long logsChannelId = plugin.getConfig().getLong("logs-channel-id", 0L);
        if (logsChannelId <= 0L) return;

        TextChannel logsChannel = channel.getGuild().getTextChannelById(logsChannelId);
        if (logsChannel == null) return;

        logsChannel.sendMessageEmbeds(new EmbedBuilder()
            .setAuthor("Test Ticket Closed")
            .setColor(new Color(255, 165, 0))
            .addField("👨💻 Tester", tester.getAsMention(), true)
            .addField("🎮 Player", "<@" + info.playerUserId() + ">", true)
            .addField("🎮 IGN", info.ign(), true)
            .addField("🎮 Gamemode", prettyGamemode(info.gamemodeKey()), true)
            .addField("⚠️ Reason", reason, false)
            .setFooter("PrimeTiers 🔥")
            .setTimestamp(Instant.now())
            .build())
        .queue();
    }

}
