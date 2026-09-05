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
public class AiProductivityAnalyticsDto {
    private int totalTasks;
    private int completedTasks;
    private int pendingTasks;
    private int upcomingDeadlines;
    private int totalMeetings;
    private double completionRate;
    private int unreadMessagesCount;
    private int totalFilesCount;
    private String productivityInsight;
    @Builder.Default
    private List<DailyMetric> weeklyTrend = new ArrayList<>();

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DailyMetric {
        private String day;
        private int completed;
        private int created;
    }
}
