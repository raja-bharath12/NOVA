package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchControlSignalDto {

    public enum Type {
        PLAY,
        PAUSE,
        SEEK,
        SYNC,
        JOIN,
        LEAVE,
        ROOM_ENDED,
        HOST_TRANSFER,
        CHAT_MESSAGE
    }

    private Type type;
    private String roomCode;
    private Double position; // seconds
    private boolean isPlaying;
    private Double playbackRate;
    private Instant serverTimestamp;
    private Long senderId;
    private String senderName;
    private String senderTag;
    private Object payload;
}
