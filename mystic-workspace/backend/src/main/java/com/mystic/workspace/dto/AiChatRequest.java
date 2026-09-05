package com.mystic.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiChatRequest {
    @NotBlank
    private String prompt;
    private String contextMode; // GENERAL, SCHEDULE, TASKS, MEETING
}
