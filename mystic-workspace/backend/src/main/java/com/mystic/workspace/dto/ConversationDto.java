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
public class ConversationDto {
    private Long id;
    private String type; // DIRECT, GROUP
    private String title;
    private UserDto createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    @Builder.Default
    private List<UserDto> members = new ArrayList<>();
    private MessageDto lastMessage;
    private long unreadCount;
    private String userRole; // ADMIN, MEMBER
}
