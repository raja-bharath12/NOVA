package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

public class WatchUploadDtos {

    public static final long MAX_VIDEO_FILE_SIZE = 5L * 1024 * 1024 * 1024; // 5 GB (5,368,709,120 bytes)
    public static final long DEFAULT_PART_SIZE = 10L * 1024 * 1024; // 10 MB chunk size for S3 multipart upload

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InitRequest {
        private String title;
        private String filename;
        private Long fileSize;
        private String mimeType;
        private Integer partCount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InitResponse {
        private Long mediaId;
        private String storageKey;
        private String uploadId;
        private String singleUploadUrl;
        private Long partSize;
        private Integer totalParts;
        private String storageType;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PartUrlsRequest {
        private Long mediaId;
        private String uploadId;
        private List<Integer> partNumbers;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PartUrlsResponse {
        private Long mediaId;
        private String uploadId;
        private Map<Integer, String> partUrls;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CompletedPartDto {
        private int partNumber;
        private String eTag;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CompleteRequest {
        private Long mediaId;
        private String uploadId;
        private List<CompletedPartDto> parts;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AbortRequest {
        private Long mediaId;
        private String uploadId;
    }
}
