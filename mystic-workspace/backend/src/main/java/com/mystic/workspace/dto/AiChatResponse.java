package com.mystic.workspace.dto;

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
public class AiChatResponse {
    private String response;
    private String summary;
    @Builder.Default
    private List<AiTaskSuggestionDto> suggestedTasks = new ArrayList<>();
    @Builder.Default
    private List<String> scheduleRecommendations = new ArrayList<>();
    private AiMeetingSummaryDto meetingSummary;
}
