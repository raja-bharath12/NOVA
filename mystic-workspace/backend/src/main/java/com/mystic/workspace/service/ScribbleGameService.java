package com.mystic.workspace.service;

import com.mystic.workspace.dto.ScribbleDtos.*;
import com.mystic.workspace.entity.User;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScribbleGameService {

    private final SimpMessagingTemplate messagingTemplate;
    private final ScribbleWordDictionary wordDictionary;
    private final Map<String, RoomInstance> rooms = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);
    private final SecureRandom random = new SecureRandom();

    public static class RoomInstance {
        @Getter private final String roomCode;
        @Getter private String title;
        @Getter private Long hostId;
        @Getter private String hostName;
        @Getter private RoomSettings settings;
        @Getter private GamePhase phase = GamePhase.LOBBY;
        @Getter private int currentRound = 1;
        @Getter private int currentTurnIndex = 0;
        @Getter private final List<PlayerState> players = new CopyOnWriteArrayList<>();
        @Getter private final List<DrawAction> currentCanvasActions = new CopyOnWriteArrayList<>();
        
        // Active turn details
        @Getter private PlayerState currentDrawer;
        @Getter private Long previousDrawerId;
        @Getter private WordOption currentWord;
        @Getter private List<WordOption> currentWordChoices = new ArrayList<>();
        @Getter private int timeRemaining = 30;
        @Getter private int totalTurnSeconds = 30;
        @Getter private String lastRevealedWord = "";
        @Getter private final Set<Long> solvedPlayerIds = ConcurrentHashMap.newKeySet();
        @Getter private final Map<Long, Integer> turnGuessOrder = new ConcurrentHashMap<>();
        @Getter private final Map<Long, Integer> turnGuessTimeRemaining = new ConcurrentHashMap<>();
        @Getter private final Set<Integer> revealedIndices = ConcurrentHashMap.newKeySet();
        @Getter private long turnStartTimeMs = 0;

        private ScheduledFuture<?> activeTimerTask;

        public RoomInstance(String roomCode, String title, Long hostId, String hostName, RoomSettings settings) {
            this.roomCode = roomCode;
            this.title = title != null && !title.isBlank() ? title : "Scribble Arena " + roomCode;
            this.hostId = hostId;
            this.hostName = hostName;
            this.settings = settings != null ? settings : RoomSettings.builder()
                    .roundCount(3)
                    .turnDurationSeconds(30)
                    .maxPlayers(12)
                    .customWordsOnly(false)
                    .isPublic(true)
                    .build();
        }

        public synchronized void stopTimer() {
            if (activeTimerTask != null && !activeTimerTask.isDone()) {
                activeTimerTask.cancel(true);
            }
        }

        public synchronized void setTimerTask(ScheduledFuture<?> task) {
            stopTimer();
            this.activeTimerTask = task;
        }

        public String getMaskedWord() {
            if (currentWord == null || currentWord.getWord() == null) return "";
            String raw = currentWord.getWord();
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < raw.length(); i++) {
                char c = raw.charAt(i);
                if (c == ' ' || c == '-' || c == '\'') {
                    sb.append(c).append(" ");
                } else if (revealedIndices.contains(i)) {
                    sb.append(c).append(" ");
                } else {
                    sb.append("_ ");
                }
            }
            return sb.toString().trim();
        }

        public RoomState toDto(Long viewerUserId) {
            boolean isDrawer = currentDrawer != null && currentDrawer.getUserId() != null && currentDrawer.getUserId().equals(viewerUserId);
            return RoomState.builder()
                    .roomCode(roomCode)
                    .title(title)
                    .hostId(hostId)
                    .hostName(hostName)
                    .phase(phase)
                    .currentRound(currentRound)
                    .totalRounds(settings.getRoundCount())
                    .currentTurnIndex(currentTurnIndex)
                    .currentDrawerId(currentDrawer != null ? currentDrawer.getUserId() : null)
                    .currentDrawerName(currentDrawer != null ? currentDrawer.getName() : null)
                    .maskedWord(isDrawer ? (currentWord != null ? currentWord.getWord() : "") : getMaskedWord())
                    .wordLength(currentWord != null ? currentWord.getWord().replace(" ", "").length() : 0)
                    .wordHint(currentWord != null ? currentWord.getHint() : "")
                    .timeRemaining(timeRemaining)
                    .totalTurnSeconds(totalTurnSeconds)
                    .players(new ArrayList<>(players))
                    .settings(settings)
                    .wordChoices(isDrawer && phase == GamePhase.WORD_SELECTION ? currentWordChoices : Collections.emptyList())
                    .lastRevealedWord(lastRevealedWord)
                    .build();
        }
    }

    /**
     * Creates a new multiplayer Scribble game room.
     */
    public RoomState createRoom(User host, CreateRoomRequest req) {
        String roomCode = generateRoomCode();
        RoomSettings settings = RoomSettings.builder()
                .roundCount(req.getRoundCount() != null ? req.getRoundCount() : 3)
                .turnDurationSeconds(req.getTurnDurationSeconds() != null ? req.getTurnDurationSeconds() : 30)
                .maxPlayers(req.getMaxPlayers() != null ? req.getMaxPlayers() : 12)
                .isPublic(req.getIsPublic() != null ? req.getIsPublic() : true)
                .build();

        RoomInstance room = new RoomInstance(
                roomCode,
                req.getTitle(),
                host != null ? host.getId() : null,
                host != null ? host.getName() : null,
                settings
        );

        if (host != null) {
            PlayerState hostPlayer = PlayerState.builder()
                    .userId(host.getId())
                    .name(host.getName())
                    .userTag(host.getUserTag())
                    .score(0)
                    .roundScore(0)
                    .isHost(true)
                    .isConnected(true)
                    .build();
            room.getPlayers().add(hostPlayer);
        }

        rooms.put(roomCode, room);
        log.info("Created Scribble room: code={}, host={}", roomCode, room.getHostName());
        return room.toDto(host != null ? host.getId() : null);
    }

    public List<RoomState> listPublicRooms() {
        List<RoomState> list = new ArrayList<>();
        for (RoomInstance room : rooms.values()) {
            if (room.getSettings().isPublic() && room.getPhase() != GamePhase.GAME_OVER) {
                list.add(room.toDto(null));
            }
        }
        return list;
    }

    public RoomState getRoomState(String roomCode, Long viewerUserId) {
        RoomInstance room = getRoom(roomCode);
        return room != null ? room.toDto(viewerUserId) : null;
    }

    public RoomInstance getRoom(String roomCode) {
        if (roomCode == null) return null;
        return rooms.get(roomCode.trim().toUpperCase());
    }

    /**
     * Join an existing Scribble room.
     */
    public synchronized RoomState joinRoom(String roomCode, User user, JoinRoomRequest guestReq) {
        RoomInstance room = getRoom(roomCode);
        if (room == null) return null;

        Long userId = user != null ? user.getId() : (guestReq != null && guestReq.getUserTag() != null ? (long) Math.abs(guestReq.getUserTag().hashCode()) : 9999L);
        String name = user != null ? user.getName() : (guestReq != null && guestReq.getPlayerName() != null ? guestReq.getPlayerName() : "Player");
        String avatar = guestReq != null ? guestReq.getAvatar() : null;
        String tag = user != null ? user.getUserTag() : (guestReq != null ? guestReq.getUserTag() : "guest");

        // Check if player already in room by userId or name match
        Optional<PlayerState> existing = room.getPlayers().stream()
                .filter(p -> p.getUserId().equals(userId) || (name != null && name.equalsIgnoreCase(p.getName())))
                .findFirst();
        if (existing.isPresent()) {
            PlayerState player = existing.get();
            player.setConnected(true);
            player.setUserId(userId);
            player.setName(name);
            if (room.getHostId() == null || room.getHostId().equals(userId)) {
                room.hostId = userId;
                room.hostName = name;
                player.setHost(true);
            }
        } else {
            if (room.getPlayers().size() >= room.getSettings().getMaxPlayers()) {
                throw new IllegalStateException("Room is full!");
            }
            boolean isFirst = room.getPlayers().isEmpty() || room.getHostId() == null;
            PlayerState newPlayer = PlayerState.builder()
                    .userId(userId)
                    .name(name)
                    .avatar(avatar)
                    .userTag(tag)
                    .score(0)
                    .roundScore(0)
                    .isHost(isFirst || (room.getHostId() != null && room.getHostId().equals(userId)))
                    .isConnected(true)
                    .build();
            room.getPlayers().add(newPlayer);
            if (isFirst) {
                room.hostId = userId;
                room.hostName = name;
            }
        }

        broadcastRoomState(room);
        broadcastSystemChat(room, name + " joined the room!", ChatMessage.MsgType.PLAYER_JOIN);
        return room.toDto(userId);
    }

    /**
     * Handle player leaving or disconnecting.
     */
    public synchronized void leaveRoom(String roomCode, Long userId) {
        RoomInstance room = getRoom(roomCode);
        if (room == null || userId == null) return;

        Optional<PlayerState> playerOpt = room.getPlayers().stream().filter(p -> p.getUserId().equals(userId)).findFirst();
        if (playerOpt.isPresent()) {
            PlayerState player = playerOpt.get();
            player.setConnected(false);
            room.getPlayers().remove(player);
            broadcastSystemChat(room, player.getName() + " left the room!", ChatMessage.MsgType.PLAYER_LEAVE);

            // If host left, elect new host
            if (player.isHost() && !room.getPlayers().isEmpty()) {
                PlayerState nextHost = room.getPlayers().get(0);
                nextHost.setHost(true);
                room.hostId = nextHost.getUserId();
                room.hostName = nextHost.getName();
                broadcastSystemChat(room, "👑 " + nextHost.getName() + " is now the host.", ChatMessage.MsgType.SYSTEM);
            }

            // If current drawer left, advance turn safely
            if (room.getCurrentDrawer() != null && room.getCurrentDrawer().getUserId().equals(userId)) {
                broadcastSystemChat(room, "🎨 Drawer disconnected. Moving to next turn...", ChatMessage.MsgType.SYSTEM);
                if (room.getPhase() == GamePhase.WORD_SELECTION) {
                    startTurn(room);
                } else {
                    endTurn(room, "Drawer disconnected");
                }
            }

            // If room is empty, clean up after 5 minutes
            boolean anyConnected = room.getPlayers().stream().anyMatch(PlayerState::isConnected);
            if (!anyConnected) {
                scheduler.schedule(() -> {
                    boolean stillEmpty = room.getPlayers().stream().noneMatch(PlayerState::isConnected);
                    if (stillEmpty) {
                        room.stopTimer();
                        rooms.remove(room.getRoomCode());
                        log.info("Cleaned up deserted Scribble room: {}", room.getRoomCode());
                    }
                }, 5, TimeUnit.MINUTES);
            } else {
                broadcastRoomState(room);
            }
        }
    }

    /**
     * Host starts the game match.
     */
    public synchronized void startGame(String roomCode, Long hostId) {
        RoomInstance room = getRoom(roomCode);
        if (room == null || room.getPlayers().isEmpty()) return;
        if (room.phase != GamePhase.LOBBY && room.phase != GamePhase.GAME_OVER) {
            log.info("Game match already started for room: {}", roomCode);
            return;
        }

        room.phase = GamePhase.WORD_SELECTION;
        room.currentRound = 1;
        room.currentTurnIndex = 0;
        room.previousDrawerId = null;
        room.getPlayers().forEach(p -> {
            p.setScore(0);
            p.setRoundScore(0);
        });

        startTurn(room);
    }

    /**
     * Host restarts game back to lobby.
     */
    public synchronized void restartGame(String roomCode, Long hostId) {
        RoomInstance room = getRoom(roomCode);
        if (room == null) return;
        room.stopTimer();
        room.phase = GamePhase.LOBBY;
        room.currentRound = 1;
        room.currentTurnIndex = 0;
        room.currentDrawer = null;
        room.previousDrawerId = null;
        room.currentWord = null;
        room.lastRevealedWord = "";
        room.currentCanvasActions.clear();
        room.solvedPlayerIds.clear();
        room.turnGuessOrder.clear();
        room.turnGuessTimeRemaining.clear();
        room.getPlayers().forEach(p -> {
            p.setScore(0);
            p.setRoundScore(0);
            p.setDrawing(false);
            p.setHasGuessed(false);
        });
        broadcastRoomState(room);
        broadcastCanvasAction(room, DrawAction.builder().type(DrawAction.Type.CLEAR).build());
        broadcastSystemChat(room, "🔄 Game returned to lobby for a new match!", ChatMessage.MsgType.SYSTEM);
    }

    /**
     * Host ends game for everyone.
     */
    public synchronized void endGame(String roomCode, Long hostId) {
        RoomInstance room = getRoom(roomCode);
        if (room == null) return;
        room.stopTimer();
        room.phase = GamePhase.GAME_OVER;
        broadcastRoomState(room);
        broadcastSystemChat(room, "🛑 The host ended this game.", ChatMessage.MsgType.SYSTEM);
    }

    /**
     * Initiates word selection phase for current turn.
     * Selects a random available player (excluding previous drawer if possible).
     */
    private synchronized void startTurn(RoomInstance room) {
        if (room.getPlayers().isEmpty()) return;

        // Reset turn state
        room.currentCanvasActions.clear();
        room.solvedPlayerIds.clear();
        room.turnGuessOrder.clear();
        room.turnGuessTimeRemaining.clear();
        room.revealedIndices.clear();
        room.phase = GamePhase.WORD_SELECTION;
        room.timeRemaining = 10; // Exactly 10 seconds for word selection
        room.totalTurnSeconds = 10;

        // Pick random available connected drawer (prevent immediate consecutive repeat)
        List<PlayerState> activePlayers = room.getPlayers().stream()
                .filter(PlayerState::isConnected)
                .toList();
        if (activePlayers.isEmpty()) {
            activePlayers = room.getPlayers();
        }

        List<PlayerState> eligibleDrawers = activePlayers.stream()
                .filter(p -> room.previousDrawerId == null || !p.getUserId().equals(room.previousDrawerId))
                .toList();
        if (eligibleDrawers.isEmpty()) {
            eligibleDrawers = activePlayers;
        }

        PlayerState drawer = eligibleDrawers.get(random.nextInt(eligibleDrawers.size()));
        room.previousDrawerId = drawer.getUserId();
        room.currentDrawer = drawer;

        room.getPlayers().forEach(p -> {
            p.setDrawing(p.getUserId().equals(drawer.getUserId()));
            p.setHasGuessed(false);
            p.setRoundScore(0);
        });

        // Generate 3 words (Easy, Med, Hard)
        room.currentWordChoices = wordDictionary.getThreeRandomOptions();
        room.currentWord = null; // Not chosen yet

        broadcastRoomState(room);
        broadcastCanvasAction(room, DrawAction.builder().type(DrawAction.Type.CLEAR).build());

        // Send private word choices to drawer only
        messagingTemplate.convertAndSend(
                "/topic/scribble." + room.getRoomCode() + ".private." + drawer.getUserId(),
                room.toDto(drawer.getUserId())
        );

        broadcastSystemChat(room, drawer.getName() + " is choosing a word...", ChatMessage.MsgType.DRAWER_PICKED);

        // 10-second Word selection countdown
        room.setTimerTask(scheduler.scheduleAtFixedRate(() -> {
            synchronized (room) {
                room.timeRemaining--;
                if (room.timeRemaining <= 0) {
                    // Auto-select random word after 10 seconds
                    if (room.currentWord == null && !room.currentWordChoices.isEmpty()) {
                        WordOption autoWord = room.currentWordChoices.get(random.nextInt(room.currentWordChoices.size()));
                        selectWord(room.getRoomCode(), drawer.getUserId(), autoWord.getWord());
                    }
                } else {
                    broadcastTimerTick(room);
                }
            }
        }, 1, 1, TimeUnit.SECONDS));
    }

    /**
     * Active drawer selects their word and drawing phase commences.
     */
    public synchronized void selectWord(String roomCode, Long drawerId, String chosenWord) {
        RoomInstance room = getRoom(roomCode);
        if (room == null || room.getPhase() != GamePhase.WORD_SELECTION) return;
        if (drawerId != null && room.getCurrentDrawer() != null && !room.getCurrentDrawer().getUserId().equals(drawerId) && room.getPlayers().size() > 1) {
            return;
        }

        Optional<WordOption> match = room.getCurrentWordChoices().stream()
                .filter(w -> w.getWord().equalsIgnoreCase(chosenWord))
                .findFirst();

        room.currentWord = match.orElseGet(() -> WordOption.builder()
                .word(chosenWord.toUpperCase())
                .difficulty(Difficulty.MEDIUM)
                .hint("Custom drawing word")
                .build());

        // Transition to DRAWING phase: exactly 30 seconds guessing time
        room.phase = GamePhase.DRAWING;
        room.totalTurnSeconds = 30;
        room.timeRemaining = 30;
        room.turnStartTimeMs = System.currentTimeMillis();

        broadcastRoomState(room);

        // Send unmasked secret word to drawer's private channel
        Long currentDrawerId = room.getCurrentDrawer() != null ? room.getCurrentDrawer().getUserId() : drawerId;
        if (currentDrawerId != null) {
            messagingTemplate.convertAndSend(
                    "/topic/scribble." + room.getRoomCode() + ".private." + currentDrawerId,
                    room.toDto(currentDrawerId)
            );
        }

        broadcastSystemChat(room, room.getCurrentDrawer().getName() + " is drawing now!", ChatMessage.MsgType.DRAWER_PICKED);

        // Drawing countdown loop (30s)
        room.setTimerTask(scheduler.scheduleAtFixedRate(() -> {
            synchronized (room) {
                room.timeRemaining--;

                // Timed hints at 15s and 8s remaining
                String raw = room.getCurrentWord().getWord();
                int len = raw.length();
                if (room.timeRemaining == 15 && len > 3) {
                    revealRandomLetter(room);
                    broadcastRoomState(room);
                } else if (room.timeRemaining == 8 && len > 5) {
                    revealRandomLetter(room);
                    broadcastRoomState(room);
                }

                if (room.timeRemaining <= 0) {
                    endTurn(room, "Time is up!");
                } else {
                    broadcastTimerTick(room);
                }
            }
        }, 1, 1, TimeUnit.SECONDS));
    }

    private void revealRandomLetter(RoomInstance room) {
        String raw = room.getCurrentWord().getWord();
        List<Integer> unrevealed = new ArrayList<>();
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c != ' ' && c != '-' && !room.revealedIndices.contains(i)) {
                unrevealed.add(i);
            }
        }
        if (!unrevealed.isEmpty()) {
            int idx = unrevealed.get(random.nextInt(unrevealed.size()));
            room.revealedIndices.add(idx);
        }
    }

    /**
     * Submit a guess or message in chat.
     * Enforces STRICT EXACT-MATCH checking normalized to trimmed lowercase.
     * NO fuzzy matching, NO includes, NO partial matches.
     * Correct guess is NEVER displayed as a chat message.
     */
    public synchronized void handleGuess(String roomCode, User user, String text, Long guestUserId, String guestName) {
        RoomInstance room = getRoom(roomCode);
        if (room == null || text == null || text.isBlank()) return;

        Long tempSenderId = user != null ? user.getId() : (guestUserId != null ? guestUserId : 9999L);
        String tempSenderName = user != null ? user.getName() : (guestName != null ? guestName : "Player");
        String tempSenderTag = user != null ? user.getUserTag() : "guest";

        // Try to match with room player if user was null
        if (user == null && !room.getPlayers().isEmpty()) {
            final Long lookupId = tempSenderId;
            Optional<PlayerState> match = room.getPlayers().stream()
                    .filter(p -> p.getUserId().equals(lookupId) || (guestName != null && guestName.equalsIgnoreCase(p.getName())))
                    .findFirst();
            if (match.isPresent()) {
                tempSenderId = match.get().getUserId();
                tempSenderName = match.get().getName();
                tempSenderTag = match.get().getUserTag();
            } else if (room.getPlayers().size() == 1) {
                tempSenderId = room.getPlayers().get(0).getUserId();
                tempSenderName = room.getPlayers().get(0).getName();
                tempSenderTag = room.getPlayers().get(0).getUserTag();
            }
        }

        final Long senderId = tempSenderId;
        final String senderName = tempSenderName;
        final String senderTag = tempSenderTag;

        String cleanText = text.trim();

        // If not in drawing phase, timer expired, or sender is active drawer, send normal chat
        if (room.getPhase() != GamePhase.DRAWING || room.getTimeRemaining() <= 0 || (room.getCurrentDrawer() != null && room.getCurrentDrawer().getUserId().equals(senderId))) {
            broadcastChat(room, ChatMessage.builder()
                    .id(UUID.randomUUID().toString())
                    .type(ChatMessage.MsgType.CHAT)
                    .senderId(senderId)
                    .senderName(senderName)
                    .senderTag(senderTag)
                    .content(cleanText)
                    .timestamp(System.currentTimeMillis())
                    .build());
            return;
        }

        // If player already guessed correctly this turn, reject and do not broadcast
        if (room.getSolvedPlayerIds().contains(senderId)) {
            return;
        }

        String targetWord = room.getCurrentWord() != null ? room.getCurrentWord().getWord() : "";
        String normGuess = cleanText.toLowerCase();
        String normTarget = targetWord.trim().toLowerCase();

        // EXACT MATCH CHECKING ONLY (NO includes, NO startsWith, NO fuzzy)
        boolean isExactMatch = !normTarget.isEmpty() && normGuess.equals(normTarget);

        if (isExactMatch) {
            // Immediately mark as solved & record order/time
            room.getSolvedPlayerIds().add(senderId);
            int guessOrder = room.getSolvedPlayerIds().size();
            room.turnGuessOrder.put(senderId, guessOrder);
            room.turnGuessTimeRemaining.put(senderId, room.getTimeRemaining());

            // Lock guesser
            room.getPlayers().stream().filter(p -> p.getUserId().equals(senderId)).findFirst().ifPresent(p -> {
                p.setHasGuessed(true);
            });

            // Immediately broadcast celebratory system announcement (do NOT reveal raw answer!)
            broadcastChat(room, ChatMessage.builder()
                    .id(UUID.randomUUID().toString())
                    .type(ChatMessage.MsgType.CORRECT_GUESS)
                    .senderId(senderId)
                    .senderName(senderName)
                    .senderTag(senderTag)
                    .content(senderName + " guessed the word!")
                    .timestamp(System.currentTimeMillis())
                    .build());

            broadcastRoomState(room);

            // Check if all non-drawer active players have guessed correctly
            long eligibleGuessers = room.getPlayers().stream()
                    .filter(p -> !p.getUserId().equals(room.getCurrentDrawer().getUserId()) && p.isConnected())
                    .count();

            if (eligibleGuessers > 0 && room.getSolvedPlayerIds().size() >= eligibleGuessers) {
                endTurn(room, "All players guessed correctly!");
            }
            return;
        }

        // WRONG GUESS -> Display normal chat message with player's display name
        broadcastChat(room, ChatMessage.builder()
                .id(UUID.randomUUID().toString())
                .type(ChatMessage.MsgType.CHAT)
                .senderId(senderId)
                .senderName(senderName)
                .senderTag(senderTag)
                .content(cleanText)
                .timestamp(System.currentTimeMillis())
                .build());
    }

    /**
     * Drawing actions (Stroke, Fill, Clear, Undo) streamed over WebSocket.
     */
    public void handleDrawAction(String roomCode, DrawAction action, Long senderId) {
        RoomInstance room = getRoom(roomCode);
        if (room == null) return;

        action.setSenderId(senderId);
        action.setTimestamp(System.currentTimeMillis());

        if (action.getType() == DrawAction.Type.CLEAR) {
            room.currentCanvasActions.clear();
        } else if (action.getType() == DrawAction.Type.UNDO) {
            if (!room.currentCanvasActions.isEmpty()) {
                room.currentCanvasActions.remove(room.currentCanvasActions.size() - 1);
            }
        } else if (action.getType() == DrawAction.Type.FILL) {
            room.currentCanvasActions.add(action);
        } else if (action.getType() == DrawAction.Type.END) {
            if (action.getPoints() != null && !action.getPoints().isEmpty()) {
                room.currentCanvasActions.add(action);
            }
        }

        broadcastCanvasAction(room, action);
    }

    /**
     * Conclude active turn:
     * 1. Stop timer & drawing
     * 2. Finalize round scores (applied only at turn completion)
     * 3. Show revealed word & round results
     * 4. Advance to next random drawer after 5 seconds
     */
    private synchronized void endTurn(RoomInstance room, String reason) {
        room.stopTimer();
        room.phase = GamePhase.ROUND_END;
        room.lastRevealedWord = room.getCurrentWord() != null ? room.getCurrentWord().getWord() : "";

        long totalEligibleGuessers = room.getPlayers().stream()
                .filter(p -> !p.getUserId().equals(room.getCurrentDrawer().getUserId()) && p.isConnected())
                .count();
        if (totalEligibleGuessers <= 0) totalEligibleGuessers = 1;

        // Calculate and finalize guesser scores based on guess order & time
        for (Long solvedId : room.getSolvedPlayerIds()) {
            int order = room.turnGuessOrder.getOrDefault(solvedId, 1);
            int timeLeft = room.turnGuessTimeRemaining.getOrDefault(solvedId, 0);

            // 1st: 100, 2nd: 75, 3rd: 50, subsequent: 40 (+ time bonus up to 20)
            int basePoints = order == 1 ? 100 : order == 2 ? 75 : order == 3 ? 50 : 40;
            int timeBonus = (int) (((double) timeLeft / 30.0) * 20.0);
            int totalGuesserPoints = basePoints + timeBonus;

            room.getPlayers().stream().filter(p -> p.getUserId().equals(solvedId)).findFirst().ifPresent(p -> {
                p.setRoundScore(totalGuesserPoints);
                p.setScore(p.getScore() + totalGuesserPoints);
            });
        }

        // Calculate and finalize drawer score based on how many guessed correctly
        int solvedCount = room.getSolvedPlayerIds().size();
        if (room.getCurrentDrawer() != null) {
            int drawerPoints = solvedCount > 0 ? (int) (((double) solvedCount / totalEligibleGuessers) * 100.0) : 0;
            room.getCurrentDrawer().setRoundScore(drawerPoints);
            room.getCurrentDrawer().setScore(room.getCurrentDrawer().getScore() + drawerPoints);
        }

        broadcastRoomState(room);
        broadcastSystemChat(room, "🔔 Drawing Complete! The word was \"" + room.lastRevealedWord + "\"", ChatMessage.MsgType.SYSTEM);

        // 5-second round result intermission before next turn
        room.setTimerTask(scheduler.schedule(() -> advanceTurn(room), 5, TimeUnit.SECONDS));
    }

    /**
     * Advances to the next turn or finishes match if all rounds complete.
     */
    private synchronized void advanceTurn(RoomInstance room) {
        room.currentTurnIndex++;
        int totalPlayers = Math.max(1, (int) room.getPlayers().stream().filter(PlayerState::isConnected).count());

        // Check if round is complete (everyone drawn once)
        if (room.currentTurnIndex % totalPlayers == 0) {
            room.currentRound++;
            if (room.currentRound > room.getSettings().getRoundCount()) {
                // MATCH OVER!
                room.phase = GamePhase.GAME_OVER;
                broadcastRoomState(room);
                broadcastSystemChat(room, "🏆 Match Completed! Check the podium leaderboard!", ChatMessage.MsgType.SYSTEM);
                return;
            }
        }

        startTurn(room);
    }

    private void broadcastRoomState(RoomInstance room) {
        messagingTemplate.convertAndSend("/topic/scribble." + room.getRoomCode(), room.toDto(null));
    }

    private void broadcastTimerTick(RoomInstance room) {
        messagingTemplate.convertAndSend("/topic/scribble." + room.getRoomCode() + ".timer", Map.of(
                "timeRemaining", room.getTimeRemaining(),
                "totalTurnSeconds", room.getTotalTurnSeconds(),
                "phase", room.getPhase().name()
        ));
    }

    private void broadcastCanvasAction(RoomInstance room, DrawAction action) {
        messagingTemplate.convertAndSend("/topic/scribble." + room.getRoomCode() + ".canvas", action);
    }

    private void broadcastChat(RoomInstance room, ChatMessage msg) {
        messagingTemplate.convertAndSend("/topic/scribble." + room.getRoomCode() + ".chat", msg);
    }

    private void broadcastSystemChat(RoomInstance room, String text, ChatMessage.MsgType type) {
        broadcastChat(room, ChatMessage.builder()
                .id(UUID.randomUUID().toString())
                .type(type)
                .senderName("NOVA Arena")
                .content(text)
                .timestamp(System.currentTimeMillis())
                .build());
    }

    private String generateRoomCode() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder("SCRIB-");
        for (int i = 0; i < 4; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private int calculateLevenshtein(String a, String b) {
        if (a == null || b == null) return 999;
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;

        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = (a.charAt(i - 1) == b.charAt(j - 1)) ? 0 : 1;
                dp[i][j] = Math.min(
                        Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1),
                        dp[i - 1][j - 1] + cost
                );
            }
        }
        return dp[a.length()][b.length()];
    }
}
