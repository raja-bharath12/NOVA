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
public class GlobalSearchResultDto {
    private String id;
    private String type; // TASK, EVENT, MESSAGE, FILE, MEETING, WHITEBOARD
    private String title;
    private String description;
    private String subtitle;
    private String ownerName;
    private Instant timestamp;
    private String url;
    private String tag;
}
