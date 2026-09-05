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
public class MeetingDto {
    private Long id;
    private String roomCode;
    private String title;
    private String description;
    private UserDto host;
    private Instant scheduledStartTime;
    private String status; // WAITING, ACTIVE, ENDED
    private Instant createdAt;
    private Instant startedAt;
    private Instant endedAt;
    @Builder.Default
    private List<MeetingParticipantDto> participants = new ArrayList<>();
}
