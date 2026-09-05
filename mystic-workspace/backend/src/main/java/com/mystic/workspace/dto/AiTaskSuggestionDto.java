package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiTaskSuggestionDto {
    private String title;
    private String description;
    private String priority; // LOW, MEDIUM, HIGH
    private String category;
    private String deadline; // yyyy-MM-dd
}
