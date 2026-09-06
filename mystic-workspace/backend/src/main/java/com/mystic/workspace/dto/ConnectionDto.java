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
public class ConnectionDto {
    private Long id;
    private UserDto requester;
    private UserDto recipient;
    private String status; // PENDING, ACCEPTED, DECLINED
    private Instant createdAt;
    private Instant updatedAt;
}
