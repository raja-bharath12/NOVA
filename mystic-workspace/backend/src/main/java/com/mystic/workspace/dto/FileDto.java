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
public class FileDto {
    private Long id;
    private String originalFilename;
    private String storageKey;
    private String mimeType;
    private Long fileSize;
    private String storageType;
    private UserDto owner;
    private Long conversationId;
    private Long messageId;
    private boolean isShared;
    private Instant createdAt;
    private String downloadUrl;
}
