package com.mystic.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateMeetingRequest {
    @NotBlank
    private String title;
    private String description;
    private Instant scheduledStartTime;
}
