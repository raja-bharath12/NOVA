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
public class PresenceNotification {
    private Long userId;
    private String userName;
    private String status; // ONLINE, AWAY, OFFLINE
    private Instant timestamp;
}
