package com.mystic.workspace.service.storage;

import com.mystic.workspace.entity.FileMetadata;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {

    /**
     * Stores a multipart file and returns the unique storage key.
     */
    String store(MultipartFile file);

    /**
     * Loads a file as a readable Spring Resource.
     */
    Resource loadAsResource(FileMetadata metadata);

    /**
     * Deletes a stored file.
     */
    void delete(FileMetadata metadata);

    /**
     * Gets a direct download URL if applicable (e.g. S3 presigned URL). Returns null for local storage.
     */
    String getDirectDownloadUrl(FileMetadata metadata);
}
