package com.mystic.workspace.dto;

import com.mystic.workspace.entity.WatchMedia;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchMediaDto {
    private Long id;
    private String title;
    private String originalFilename;
    private String storageKey;
    private String mimeType;
    private Long fileSize;
    private Double duration;
    private String thumbnailUrl;
    private String manifestUrl;
    private String streamUrl;
    private WatchMedia.Status status;
    private Long ownerId;
    private String ownerName;
    private Instant createdAt;
}
