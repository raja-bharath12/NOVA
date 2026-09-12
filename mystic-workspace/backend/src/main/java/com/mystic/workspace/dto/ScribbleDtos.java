package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ScribbleDtos {

    public enum GamePhase {
        LOBBY,
        WORD_SELECTION,
        DRAWING,
        ROUND_END,
        GAME_OVER
    }

    public enum Difficulty {
        EASY,
        MEDIUM,
        HARD
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WordOption {
        private String word;
        private Difficulty difficulty;
        private String hint;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlayerState {
        private Long userId;
        private String name;
        private String avatar;
        private String userTag;
        private int score;
        private int roundScore;
        private boolean isHost;
        private boolean isDrawing;
        private boolean hasGuessed;
        private long guessTimeRemaining;
        private boolean isConnected;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomSettings {
        private int roundCount; // e.g. 3
        private int turnDurationSeconds; // e.g. 80
        private int maxPlayers; // e.g. 12
        private boolean customWordsOnly;
        private boolean isPublic;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomState {
        private String roomCode;
        private String title;
        private Long hostId;
        private String hostName;
        private GamePhase phase;
        private int currentRound;
        private int totalRounds;
        private int currentTurnIndex;
        private Long currentDrawerId;
        private String currentDrawerName;
        private String maskedWord;
        private int wordLength;
        private String wordHint;
        private int timeRemaining;
        private int totalTurnSeconds;
        private List<PlayerState> players;
        private RoomSettings settings;
        private List<WordOption> wordChoices; // Only populated for active drawer
        private String lastRevealedWord;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DrawPoint {
        private double x; // Normalized 0.0 - 1.0
        private double y; // Normalized 0.0 - 1.0
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DrawAction {
        public enum Type {
            START,
            STROKE,
            END,
            FILL,
            CLEAR,
            UNDO
        }

        private Type type;
        private List<DrawPoint> points;
        private String color; // Hex string e.g. #FF0000
        private double width; // Scaled relative width or px
        private String tool; // "brush", "pencil", "eraser", "fill"
        private DrawPoint fillPoint;
        private long timestamp;
        private Long senderId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessage {
        public enum MsgType {
            CHAT,
            SYSTEM,
            CORRECT_GUESS,
            CLOSE_GUESS,
            PLAYER_JOIN,
            PLAYER_LEAVE,
            DRAWER_PICKED
        }

        private String id;
        private MsgType type;
        private Long senderId;
        private String senderName;
        private String senderTag;
        private String content;
        private int pointsEarned;
        private long timestamp;
        private boolean isPrivate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GuessPayload {
        private String text;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRoomRequest {
        private String title;
        private Integer roundCount;
        private Integer turnDurationSeconds;
        private Integer maxPlayers;
        private Boolean isPublic;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JoinRoomRequest {
        private String playerName;
        private String avatar;
        private String userTag;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SelectWordRequest {
        private String word;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FlagAction {
        private String reason; // "WORD_WRITING", "INAPPROPRIATE"
    }
}
