package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

public class MusicDtos {

    public static final long MAX_AUDIO_FILE_SIZE = 200L * 1024 * 1024; // 200 MB max

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackDto {
        private Long id;
        private String title;
        private String artist;
        private String album;
        private String originalFilename;
        private String storageKey;
        private String mimeType;
        private Long fileSize;
        private Double duration;
        private String coverArtUrl;
        private String streamUrl;
        private Long uploaderId;
        private String uploaderName;
        private Instant createdAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateRoomRequest {
        private String title;
        private Long initialTrackId;
        private Boolean isCollaborative;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QueueItemDto {
        private Long id;
        private TrackDto track;
        private Long addedById;
        private String addedByName;
        private Integer orderIndex;
        private Instant addedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberDto {
        private Long id;
        private Long userId;
        private String userName;
        private String userTag;
        private String email;
        private String role;
        private Instant joinedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomDto {
        private Long id;
        private String roomCode;
        private String title;
        private Long hostId;
        private String hostName;
        private String hostEmail;
        private TrackDto currentTrack;
        private Double currentPosition;
        @com.fasterxml.jackson.annotation.JsonProperty("isPlaying")
        private boolean isPlaying;
        private Double playbackRate;
        @com.fasterxml.jackson.annotation.JsonProperty("isCollaborative")
        private boolean isCollaborative;
        private String status;
        private Instant lastSyncedAt;
        private List<MemberDto> members;
        private List<QueueItemDto> queue;
        private Instant createdAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddToQueueRequest {
        private Long trackId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChangeTrackRequest {
        private Long trackId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncAction {
        public enum Type { PLAY, PAUSE, SEEK, SYNC, NEXT, PREV, QUEUE_CHANGE, REACTION, CHAT, TRACK_CHANGE }

        private Type type;
        private String roomCode;
        private Long trackId;
        private Double position;
        private Double playbackRate;
        private Long timestamp; // Epoch millisecond sent
        private String emoji; // For reaction
        private String chatContent; // For chat
        private Long senderId;
        private String senderName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessageDto {
        private Long id;
        private String roomCode;
        private Long senderId;
        private String senderName;
        private String senderTag;
        private String content;
        private Instant createdAt;
    }
}
