package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TypingNotification {
    private Long conversationId;
    private Long userId;
    private String userName;
    private boolean isTyping;
}
