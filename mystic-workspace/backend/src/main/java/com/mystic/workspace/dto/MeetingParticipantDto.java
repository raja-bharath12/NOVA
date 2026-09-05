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
public class MeetingParticipantDto {
    private Long id;
    private UserDto user;
    private String role; // HOST, PARTICIPANT
    private Instant joinedAt;
    private Instant leftAt;
}
