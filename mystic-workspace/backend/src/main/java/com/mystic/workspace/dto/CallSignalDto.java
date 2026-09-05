package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallSignalDto {
    public enum Type {
        CALL_REQUEST,
        CALL_ACCEPT,
        CALL_REJECT,
        CALL_BUSY,
        CALL_END,
        OFFER,
        ANSWER,
        ICE_CANDIDATE
    }

    private Type type;
    private Long senderId;
    private String senderName;
    private Long targetUserId;
    private boolean isVideo;
    private Object sdp;
    private Object candidate;
    private String callId;
}
