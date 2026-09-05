package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeetingSignalDto {
    public enum Type {
        JOIN,
        LEAVE,
        OFFER,
        ANSWER,
        ICE_CANDIDATE,
        SCREEN_SHARE_START,
        SCREEN_SHARE_STOP,
        HAND_RAISE,
        CHAT_MESSAGE
    }

    private Type type;
    private String roomCode;
    private Long senderId;
    private String senderName;
    private Long targetUserId; // null for broadcast
    private Object sdp;
    private Object candidate;
    private boolean isScreenSharing;
    private boolean isHandRaised;
    private String chatContent;
    @Builder.Default
    private Instant timestamp = Instant.now();
}
