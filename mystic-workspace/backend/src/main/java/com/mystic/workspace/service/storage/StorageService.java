package com.mystic.workspace.service.storage;

import com.mystic.workspace.dto.WatchUploadDtos.CompletedPartDto;
import com.mystic.workspace.entity.FileMetadata;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;

public interface StorageService {

    /**
     * Stores a multipart file with default upload path and returns the unique storage key.
     */
    String store(MultipartFile file);

    /**
     * Stores a multipart file with a specific prefix directory and returns the storage key.
     */
    String store(MultipartFile file, String keyPrefix);

    /**
     * Loads a file as a readable Spring Resource using metadata.
     */
    Resource loadAsResource(FileMetadata metadata);

    /**
     * Loads a file by its storage key as a readable Spring Resource.
     */
    Resource loadAsResource(String storageKey);

    /**
     * Deletes a stored file using metadata.
     */
    void delete(FileMetadata metadata);

    /**
     * Deletes a stored file by its storage key.
     */
    void delete(String storageKey);

    /**
     * Gets a direct download URL if applicable (e.g. S3 presigned URL). Returns null for local storage.
     */
    String getDirectDownloadUrl(FileMetadata metadata);

    /**
     * Gets a direct download/streaming URL by storage key and duration. Returns null for local storage.
     */
    String getDirectDownloadUrl(String storageKey, Duration duration);

    /**
     * Generates a presigned single-PUT upload URL for direct S3 upload. Returns null for local storage.
     */
    String generatePresignedUploadUrl(String storageKey, String contentType, Duration duration);

    /**
     * Initiates an S3 Multipart Upload and returns the uploadId. Returns null for local storage.
     */
    String initiateMultipartUpload(String storageKey, String contentType);

    /**
     * Generates a presigned URL for uploading a specific part in a multipart upload. Returns null for local storage.
     */
    String generatePresignedPartUploadUrl(String storageKey, String uploadId, int partNumber, Duration duration);

    /**
     * Completes an S3 Multipart Upload by aggregating all uploaded parts and their ETags.
     */
    void completeMultipartUpload(String storageKey, String uploadId, List<CompletedPartDto> parts);

    /**
     * Aborts an active S3 Multipart Upload and cleans up incomplete parts.
     */
    void abortMultipartUpload(String storageKey, String uploadId);

    /**
     * Checks if an object exists in storage.
     */
    boolean exists(String storageKey);

    /**
     * Returns the active storage type identifier ("S3" or "LOCAL").
     */
    String getStorageType();
}
