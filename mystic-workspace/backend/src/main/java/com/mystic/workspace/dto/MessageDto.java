package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageDto {
    private Long id;
    private Long conversationId;
    private UserDto sender;
    private String content;
    private Long replyToId;
    private String replyToContent;
    private String replyToSenderName;
    private boolean isEdited;
    private boolean isDeleted;
    private Instant createdAt;
    private Instant updatedAt;
    @Builder.Default
    private List<FileDto> attachments = new ArrayList<>();
    @Builder.Default
    private List<Long> readByUserIds = new ArrayList<>();
    private boolean isDelivered;
    private boolean isRead;
}
