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
        @Getter private WordOption currentWord;
        @Getter private List<WordOption> currentWordChoices = new ArrayList<>();
        @Getter private int timeRemaining = 80;
        @Getter private int totalTurnSeconds = 80;
        @Getter private String lastRevealedWord = "";
        @Getter private final Set<Long> solvedPlayerIds = ConcurrentHashMap.newKeySet();
        @Getter private final Set<Integer> revealedIndices = ConcurrentHashMap.newKeySet();
        @Getter private boolean firstGuessWithin30Sec = false;
        @Getter private long turnStartTimeMs = 0;

        private ScheduledFuture<?> activeTimerTask;

        public RoomInstance(String roomCode, String title, Long hostId, String hostName, RoomSettings settings) {
            this.roomCode = roomCode;
            this.title = title != null && !title.isBlank() ? title : "Scribble Arena " + roomCode;
            this.hostId = hostId;
            this.hostName = hostName;
            this.settings = settings != null ? settings : RoomSettings.builder()
                    .roundCount(3)
                    .turnDurationSeconds(80)
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
                .turnDurationSeconds(req.getTurnDurationSeconds() != null ? req.getTurnDurationSeconds() : 80)
                .maxPlayers(req.getMaxPlayers() != null ? req.getMaxPlayers() : 12)
                .isPublic(req.getIsPublic() != null ? req.getIsPublic() : true)
                .build();

        RoomInstance room = new RoomInstance(
                roomCode,
                req.getTitle(),
                host != null ? host.getId() : 1000L + random.nextInt(9000),
                host != null ? host.getName() : "Host",
                settings
        );

        if (host != null) {
            PlayerState hostPlayer = PlayerState.builder()
                    .userId(host.getId())
                    .name(host.getName())
                    .avatar(host.getAvatar())
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

        Long userId = user != null ? user.getId() : (guestReq != null ? 5000L + random.nextInt(5000) : 9999L);
        String name = user != null ? user.getName() : (guestReq != null && guestReq.getPlayerName() != null ? guestReq.getPlayerName() : "Guest " + userId);
        String avatar = user != null ? user.getAvatar() : (guestReq != null ? guestReq.getAvatar() : null);
        String tag = user != null ? user.getUserTag() : (guestReq != null ? guestReq.getUserTag() : "guest");

        // Check if player already in room
        Optional<PlayerState> existing = room.getPlayers().stream().filter(p -> p.getUserId().equals(userId)).findFirst();
        if (existing.isPresent()) {
            existing.get().setConnected(true);
            existing.get().setName(name);
        } else {
            if (room.getPlayers().size() >= room.getSettings().getMaxPlayers()) {
                throw new IllegalStateException("Room is full!");
            }
            boolean isFirst = room.getPlayers().isEmpty();
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
        broadcastSystemChat(room, name + " joined the game arena!", ChatMessage.MsgType.PLAYER_JOIN);
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
            PlayerState p = playerOpt.get();
            p.setConnected(false);
            broadcastSystemChat(room, p.getName() + " left the room.", ChatMessage.MsgType.PLAYER_LEAVE);

            // If current drawer left, advance turn
            if (room.getCurrentDrawer() != null && room.getCurrentDrawer().getUserId().equals(userId)) {
                broadcastSystemChat(room, "The drawer left the match. Advancing turn...", ChatMessage.MsgType.SYSTEM);
                advanceTurn(room);
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
        if (room == null) return;
        if (!room.getHostId().equals(hostId) && !room.getPlayers().isEmpty() && !room.getPlayers().get(0).getUserId().equals(hostId)) {
            log.warn("Non-host {} attempted to start game in {}", hostId, roomCode);
            return;
        }
        if (room.getPlayers().size() < 1) return;

        room.phase = GamePhase.WORD_SELECTION;
        room.currentRound = 1;
        room.currentTurnIndex = 0;
        room.getPlayers().forEach(p -> {
            p.setScore(0);
            p.setRoundScore(0);
        });

        startTurn(room);
    }

    /**
     * Initiates word selection phase for current turn.
     */
    private synchronized void startTurn(RoomInstance room) {
        if (room.getPlayers().isEmpty()) return;

        // Reset turn state
        room.currentCanvasActions.clear();
        room.solvedPlayerIds.clear();
        room.revealedIndices.clear();
        room.firstGuessWithin30Sec = false;
        room.phase = GamePhase.WORD_SELECTION;
        room.timeRemaining = 15; // 15 seconds to choose word
        room.totalTurnSeconds = 15;

        // Pick drawer based on turn index
        int activePlayerCount = room.getPlayers().size();
        int drawerIndex = room.currentTurnIndex % activePlayerCount;
        PlayerState drawer = room.getPlayers().get(drawerIndex);

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

        // Send private word choices to drawer
        messagingTemplate.convertAndSend(
                "/topic/scribble." + room.getRoomCode() + ".private." + drawer.getUserId(),
                room.toDto(drawer.getUserId())
        );

        broadcastSystemChat(room, "✏️ " + drawer.getName() + " is choosing a word...", ChatMessage.MsgType.DRAWER_PICKED);

        // Word selection countdown
        room.setTimerTask(scheduler.scheduleAtFixedRate(() -> {
            synchronized (room) {
                room.timeRemaining--;
                if (room.timeRemaining <= 0) {
                    // Auto-select random word if drawer didn't choose
                    if (room.currentWord == null) {
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
        if (room.getCurrentDrawer() == null || !room.getCurrentDrawer().getUserId().equals(drawerId)) return;

        Optional<WordOption> match = room.getCurrentWordChoices().stream()
                .filter(w -> w.getWord().equalsIgnoreCase(chosenWord))
                .findFirst();

        room.currentWord = match.orElseGet(() -> WordOption.builder()
                .word(chosenWord.toUpperCase())
                .difficulty(Difficulty.MEDIUM)
                .hint("Custom drawing word")
                .build());

        // Transition to DRAWING phase
        room.phase = GamePhase.DRAWING;
        room.totalTurnSeconds = room.getSettings().getTurnDurationSeconds();
        room.timeRemaining = room.totalTurnSeconds;
        room.turnStartTimeMs = System.currentTimeMillis();

        broadcastRoomState(room);
        broadcastSystemChat(room, "🎨 " + room.getCurrentDrawer().getName() + " is now drawing!", ChatMessage.MsgType.SYSTEM);

        // Drawing countdown loop
        room.setTimerTask(scheduler.scheduleAtFixedRate(() -> {
            synchronized (room) {
                room.timeRemaining--;

                // Timed hints at 50% and 25% remaining time
                String raw = room.getCurrentWord().getWord();
                int len = raw.length();
                if (room.timeRemaining == (int)(room.totalTurnSeconds * 0.5) && len > 3) {
                    revealRandomLetter(room);
                    broadcastRoomState(room);
                } else if (room.timeRemaining == (int)(room.totalTurnSeconds * 0.25) && len > 5) {
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
     */
    public synchronized void handleGuess(String roomCode, User user, String text, Long guestUserId, String guestName) {
        RoomInstance room = getRoom(roomCode);
        if (room == null || text == null || text.isBlank()) return;

        Long senderId = user != null ? user.getId() : (guestUserId != null ? guestUserId : 9999L);
        String senderName = user != null ? user.getName() : (guestName != null ? guestName : "Player");
        String senderTag = user != null ? user.getUserTag() : "guest";

        String cleanText = text.trim();

        // If not in drawing phase or sender is active drawer, send normal chat
        if (room.getPhase() != GamePhase.DRAWING || (room.getCurrentDrawer() != null && room.getCurrentDrawer().getUserId().equals(senderId))) {
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

        // If player already guessed correctly this turn, do not reveal answer to remaining guessers
        if (room.getSolvedPlayerIds().contains(senderId)) {
            // Private chat visible only to other solved players and drawer
            broadcastChat(room, ChatMessage.builder()
                    .id(UUID.randomUUID().toString())
                    .type(ChatMessage.MsgType.CHAT)
                    .senderId(senderId)
                    .senderName(senderName)
                    .senderTag(senderTag)
                    .content(cleanText)
                    .timestamp(System.currentTimeMillis())
                    .isPrivate(true)
                    .build());
            return;
        }

        String targetWord = room.getCurrentWord() != null ? room.getCurrentWord().getWord() : "";
        int levDistance = calculateLevenshtein(cleanText.toUpperCase(), targetWord.toUpperCase());

        // 1. EXACT MATCH!
        if (levDistance == 0) {
            room.getSolvedPlayerIds().add(senderId);
            long elapsedSeconds = (System.currentTimeMillis() - room.turnStartTimeMs) / 1000;
            if (elapsedSeconds <= 30) {
                room.firstGuessWithin30Sec = true;
            }

            // Calculate guesser score: Base 100 + (remaining / total) * 400
            int guesserPoints = 100 + (int) (((double) room.getTimeRemaining() / room.getTotalTurnSeconds()) * 400);

            // Update player state
            room.getPlayers().stream().filter(p -> p.getUserId().equals(senderId)).findFirst().ifPresent(p -> {
                p.setScore(p.getScore() + guesserPoints);
                p.setRoundScore(guesserPoints);
                p.setHasGuessed(true);
            });

            // Update drawer score: (solved / eligible) * 400 + (bonus if < 30s)
            int eligibleGuessers = Math.max(1, room.getPlayers().size() - 1);
            int solvedCount = room.getSolvedPlayerIds().size();
            int drawerBounty = (int) (((double) solvedCount / eligibleGuessers) * 400) + (room.isFirstGuessWithin30Sec() ? 50 : 0);

            if (room.getCurrentDrawer() != null) {
                room.getCurrentDrawer().setRoundScore(drawerBounty);
            }

            // Intercept message, broadcast celebratory green banner!
            broadcastChat(room, ChatMessage.builder()
                    .id(UUID.randomUUID().toString())
                    .type(ChatMessage.MsgType.CORRECT_GUESS)
                    .senderId(senderId)
                    .senderName(senderName)
                    .senderTag(senderTag)
                    .content(senderName + " guessed the word!")
                    .pointsEarned(guesserPoints)
                    .timestamp(System.currentTimeMillis())
                    .build());

            broadcastRoomState(room);

            // If ALL eligible guessers have solved, end turn immediately!
            if (solvedCount >= eligibleGuessers) {
                endTurn(room, "Everyone guessed the word!");
            }
            return;
        }

        // 2. CLOSE GUESS! (Levenshtein <= 1, or <= 2 for long words)
        boolean isClose = (targetWord.length() <= 4 && levDistance == 1) || (targetWord.length() > 4 && levDistance <= 2);
        if (isClose) {
            // Send private hint to guesser
            messagingTemplate.convertAndSend(
                    "/topic/scribble." + room.getRoomCode() + ".private." + senderId,
                    ChatMessage.builder()
                            .id(UUID.randomUUID().toString())
                            .type(ChatMessage.MsgType.CLOSE_GUESS)
                            .senderId(senderId)
                            .senderName("NOVA Hint")
                            .content("You are very close! ('" + cleanText + "')")
                            .timestamp(System.currentTimeMillis())
                            .isPrivate(true)
                            .build()
            );
            return;
        }

        // 3. REGULAR GUESS MESSAGE
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
        if (room == null || room.getPhase() != GamePhase.DRAWING) return;
        if (room.getCurrentDrawer() == null || !room.getCurrentDrawer().getUserId().equals(senderId)) return;

        action.setSenderId(senderId);
        action.setTimestamp(System.currentTimeMillis());

        if (action.getType() == DrawAction.Type.CLEAR) {
            room.currentCanvasActions.clear();
        } else if (action.getType() == DrawAction.Type.UNDO) {
            if (!room.currentCanvasActions.isEmpty()) {
                room.currentCanvasActions.remove(room.currentCanvasActions.size() - 1);
            }
        } else {
            room.currentCanvasActions.add(action);
        }

        broadcastCanvasAction(room, action);
    }

    /**
     * Conclude active turn, show revealed word, update total drawer score, and advance.
     */
    private synchronized void endTurn(RoomInstance room, String reason) {
        room.stopTimer();
        room.phase = GamePhase.ROUND_END;
        room.lastRevealedWord = room.getCurrentWord() != null ? room.getCurrentWord().getWord() : "";

        // Finalize drawer points
        if (room.getCurrentDrawer() != null && !room.getSolvedPlayerIds().isEmpty()) {
            room.getCurrentDrawer().setScore(room.getCurrentDrawer().getScore() + room.getCurrentDrawer().getRoundScore());
        }

        broadcastRoomState(room);
        broadcastSystemChat(room, "🔔 Turn Ended: The word was \"" + room.lastRevealedWord + "\"", ChatMessage.MsgType.SYSTEM);

        // 5-second round intermission before next turn
        room.setTimerTask(scheduler.schedule(() -> advanceTurn(room), 5, TimeUnit.SECONDS));
    }

    /**
     * Advances to the next turn or finishes match if all rounds complete.
     */
    private synchronized void advanceTurn(RoomInstance room) {
        room.currentTurnIndex++;
        int totalPlayers = Math.max(1, room.getPlayers().size());

        // Check if round is complete (everyone has drawn once)
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
