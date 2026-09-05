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
public class AiMeetingSummaryDto {
    private String title;
    private String overview;
    @Builder.Default
    private List<String> keyDecisions = new ArrayList<>();
    @Builder.Default
    private List<String> actionItems = new ArrayList<>();
    @Builder.Default
    private List<String> nextSteps = new ArrayList<>();
}
