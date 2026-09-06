package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private Long id;
    private String name;
    private String email;
    private String userTag;
    private String status; // ONLINE, AWAY, OFFLINE
    private String connectionStatus; // NONE, PENDING_SENT, PENDING_RECEIVED, CONNECTED
    private Long connectionId;
}

