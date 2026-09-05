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
public class WhiteboardDto {
    private Long id;
    private String title;
    private String dataJson;
    private UserDto owner;
    private Long meetingId;
    private String meetingRoomCode;
    private Instant createdAt;
    private Instant updatedAt;
}
