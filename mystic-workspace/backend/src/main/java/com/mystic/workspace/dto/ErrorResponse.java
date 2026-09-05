package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.Instant;

@Getter
@AllArgsConstructor
public class ErrorResponse {
    private Instant timestamp = Instant.now();
    private int status;
    private String message;

    public ErrorResponse(int status, String message) {
        this.timestamp = Instant.now();
        this.status = status;
        this.message = message;
    }
}
