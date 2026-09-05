package com.mystic.workspace.dto;

import jakarta.validation.constraints.NotEmpty;
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
public class CreateSuggestedTasksRequest {
    @NotEmpty
    @Builder.Default
    private List<AiTaskSuggestionDto> tasks = new ArrayList<>();
}
