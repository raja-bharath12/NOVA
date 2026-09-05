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
public class ReadReceiptDto {
    private Long conversationId;
    private Long messageId;
    private Long userId;
    private Instant readAt;
}
