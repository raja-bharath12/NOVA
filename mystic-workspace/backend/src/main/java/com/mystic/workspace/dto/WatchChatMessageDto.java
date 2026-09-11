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
public class WatchChatMessageDto {
    private Long id;
    private String roomCode;
    private Long senderId;
    private String senderName;
    private String senderEmail;
    private String senderTag;
    private String content;
    private Instant createdAt;
}
