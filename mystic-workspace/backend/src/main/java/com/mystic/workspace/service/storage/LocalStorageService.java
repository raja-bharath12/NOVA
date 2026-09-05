package com.mystic.workspace.service.storage;

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
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage directory: " + uploadDir, e);
        }
    }

    @Override
    public String store(MultipartFile file) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot store empty file");
        }

        String rawFilename = file.getOriginalFilename();
        String extension = "";
        if (rawFilename != null && rawFilename.contains(".")) {
            extension = rawFilename.substring(rawFilename.lastIndexOf("."));
        }

        String storageKey = UUID.randomUUID().toString() + extension;
        Path destinationFile = this.rootLocation.resolve(storageKey).normalize().toAbsolutePath();

        if (!destinationFile.getParent().equals(this.rootLocation.toAbsolutePath())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot store file outside upload directory");
        }

        try (InputStream inputStream = file.getInputStream()) {
            Files.copy(inputStream, destinationFile, StandardCopyOption.REPLACE_EXISTING);
            return storageKey;
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store file", e);
        }
    }

    @Override
    public Resource loadAsResource(FileMetadata metadata) {
        try {
            Path file = rootLocation.resolve(metadata.getStorageKey()).normalize();
            Resource resource = new UrlResource(file.toUri());
            if (resource.exists() || resource.isReadable()) {
                return resource;
            } else {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Could not read file: " + metadata.getOriginalFilename());
            }
        } catch (MalformedURLException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Could not read file", e);
        }
    }

    @Override
    public void delete(FileMetadata metadata) {
        try {
            Path file = rootLocation.resolve(metadata.getStorageKey()).normalize();
            Files.deleteIfExists(file);
        } catch (IOException ignored) {
        }
    }

    @Override
    public String getDirectDownloadUrl(FileMetadata metadata) {
        return null;
    }
}
