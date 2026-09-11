package com.mystic.workspace.service.storage;

import com.mystic.workspace.dto.WatchUploadDtos.CompletedPartDto;
import com.mystic.workspace.entity.FileMetadata;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.*;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
@ConditionalOnProperty(name = "app.storage.type", havingValue = "local", matchIfMissing = true)
public class LocalStorageService implements StorageService {

    @Value("${app.storage.local-dir:./uploads}")
    private String uploadDir;

    private Path rootLocation;

    @PostConstruct
    public void init() {
        try {
            rootLocation = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(rootLocation);
        } catch (Exception e) {
            try {
                rootLocation = Paths.get(System.getProperty("java.io.tmpdir"), "uploads").toAbsolutePath().normalize();
                Files.createDirectories(rootLocation);
            } catch (Exception fallbackEx) {
                System.err.println("Warning: Could not initialize local storage directory: " + fallbackEx.getMessage());
            }
        }
    }

    @Override
    public String store(MultipartFile file) {
        return store(file, "uploads");
    }

    @Override
    public String store(MultipartFile file, String keyPrefix) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot store empty file");
        }

        String rawFilename = file.getOriginalFilename();
        String extension = "";
        if (rawFilename != null && rawFilename.contains(".")) {
            extension = rawFilename.substring(rawFilename.lastIndexOf("."));
        }

        String prefix = (keyPrefix != null && !keyPrefix.isBlank()) ? keyPrefix.replaceAll("^/+|/+$", "") : "uploads";
        String storageKey = prefix + "/" + UUID.randomUUID().toString() + extension;
        Path destinationFile = this.rootLocation.resolve(storageKey).normalize().toAbsolutePath();

        try {
            Files.createDirectories(destinationFile.getParent());
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, destinationFile, StandardCopyOption.REPLACE_EXISTING);
                return storageKey;
            }
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store file", e);
        }
    }

    @Override
    public Resource loadAsResource(FileMetadata metadata) {
        if (metadata == null || metadata.getStorageKey() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file metadata");
        }
        return loadAsResource(metadata.getStorageKey());
    }

    @Override
    public Resource loadAsResource(String storageKey) {
        try {
            if (rootLocation != null) {
                Path file = rootLocation.resolve(storageKey).normalize();
                Resource resource = new UrlResource(file.toUri());
                if (resource.exists() && resource.isReadable()) {
                    return resource;
                }
            }

            // Fallback 1: ./uploads
            Path fallback1 = Paths.get("./uploads", storageKey).toAbsolutePath().normalize();
            Resource res1 = new UrlResource(fallback1.toUri());
            if (res1.exists() && res1.isReadable()) {
                return res1;
            }

            // Fallback 2: /tmp/uploads
            Path fallback2 = Paths.get(System.getProperty("java.io.tmpdir"), "uploads", storageKey).toAbsolutePath().normalize();
            Resource res2 = new UrlResource(fallback2.toUri());
            if (res2.exists() && res2.isReadable()) {
                return res2;
            }

            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Could not read file: " + storageKey);
        } catch (MalformedURLException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Could not read file", e);
        }
    }

    @Override
    public void delete(FileMetadata metadata) {
        if (metadata != null && metadata.getStorageKey() != null) {
            delete(metadata.getStorageKey());
        }
    }

    @Override
    public void delete(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return;
        try {
            Path file = rootLocation.resolve(storageKey).normalize();
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
        }
    }

    @Override
    public String getDirectDownloadUrl(FileMetadata metadata) {
        return null;
    }

    @Override
    public String getDirectDownloadUrl(String storageKey, Duration duration) {
        return null;
    }

    @Override
    public String generatePresignedUploadUrl(String storageKey, String contentType, Duration duration) {
        return null;
    }

    @Override
    public String initiateMultipartUpload(String storageKey, String contentType) {
        return "local-upload-" + UUID.randomUUID();
    }

    @Override
    public String generatePresignedPartUploadUrl(String storageKey, String uploadId, int partNumber, Duration duration) {
        return null;
    }

    @Override
    public void completeMultipartUpload(String storageKey, String uploadId, List<CompletedPartDto> parts) {
        // No-op for local mock
    }

    @Override
    public void abortMultipartUpload(String storageKey, String uploadId) {
        // No-op for local mock
    }

    @Override
    public boolean exists(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) return false;
        Path file = rootLocation.resolve(storageKey).normalize();
        return Files.exists(file);
    }

    @Override
    public String getStorageType() {
        return "LOCAL";
    }
}
