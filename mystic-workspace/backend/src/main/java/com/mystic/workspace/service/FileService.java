package com.mystic.workspace.service;

import com.mystic.workspace.dto.FileDto;
import com.mystic.workspace.dto.UserDto;
import com.mystic.workspace.entity.Conversation;
import com.mystic.workspace.entity.FileMetadata;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.ConversationMemberRepository;
import com.mystic.workspace.repository.ConversationRepository;
import com.mystic.workspace.repository.FileMetadataRepository;
import com.mystic.workspace.service.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileService {

    private final FileMetadataRepository fileMetadataRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final StorageService storageService;

    @Transactional
    public FileDto uploadFile(User user, MultipartFile file, Long conversationId, Boolean isShared) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            originalFilename = "unnamed-file";
        }
        // Sanitize filename
        originalFilename = originalFilename.replaceAll("[\\\\/:*?\"<>|]", "_");

        String mimeType = file.getContentType();
        if (mimeType == null || mimeType.isBlank()) {
            mimeType = "application/octet-stream";
        }

        Conversation conversation = null;
        if (conversationId != null) {
            conversation = conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

            if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, user.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to upload files to this conversation");
            }
        }

        String storageKey = storageService.store(file);
        FileMetadata.StorageType storageType = (storageService.getClass().getSimpleName().startsWith("S3"))
                ? FileMetadata.StorageType.S3
                : FileMetadata.StorageType.LOCAL;

        FileMetadata metadata = FileMetadata.builder()
                .originalFilename(originalFilename)
                .storageKey(storageKey)
                .mimeType(mimeType)
                .fileSize(file.getSize())
                .storageType(storageType)
                .owner(user)
                .conversation(conversation)
                .isShared(Boolean.TRUE.equals(isShared))
                .build();

        FileMetadata saved = fileMetadataRepository.save(metadata);
        return toDto(saved);
    }

    public List<FileDto> getFiles(User user, String category, String query) {
        List<FileMetadata> list;

        if (query != null && !query.isBlank()) {
            list = fileMetadataRepository.searchByFilename(user.getId(), query.trim());
        } else if ("images".equalsIgnoreCase(category)) {
            list = fileMetadataRepository.findByOwnerIdAndMimeTypePrefix(user.getId(), "image/");
        } else if ("videos".equalsIgnoreCase(category)) {
            list = fileMetadataRepository.findByOwnerIdAndMimeTypePrefix(user.getId(), "video/");
        } else if ("documents".equalsIgnoreCase(category)) {
            list = fileMetadataRepository.findByOwnerIdOrderByCreatedAtDesc(user.getId()).stream()
                    .filter(f -> f.getMimeType().contains("pdf") ||
                                 f.getMimeType().contains("word") ||
                                 f.getMimeType().contains("document") ||
                                 f.getMimeType().contains("text") ||
                                 f.getMimeType().contains("sheet") ||
                                 f.getMimeType().contains("presentation"))
                    .collect(Collectors.toList());
        } else if ("shared".equalsIgnoreCase(category)) {
            list = fileMetadataRepository.findSharedWithUser(user.getId());
        } else {
            list = fileMetadataRepository.findByOwnerIdOrderByCreatedAtDesc(user.getId());
        }

        return list.stream().map(this::toDto).collect(Collectors.toList());
    }

    public FileMetadata getFileMetadata(User user, Long fileId) {
        FileMetadata metadata = fileMetadataRepository.findById(fileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));

        if (!canAccessFile(user, metadata)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to access this file");
        }

        return metadata;
    }

    public Resource loadFileAsResource(User user, Long fileId) {
        FileMetadata metadata = getFileMetadata(user, fileId);
        return storageService.loadAsResource(metadata);
    }

    public String getDirectDownloadUrl(User user, Long fileId) {
        FileMetadata metadata = getFileMetadata(user, fileId);
        return storageService.getDirectDownloadUrl(metadata);
    }

    @Transactional
    public void deleteFile(User user, Long fileId) {
        FileMetadata metadata = fileMetadataRepository.findById(fileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found"));

        if (!metadata.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can delete this file");
        }

        storageService.delete(metadata);
        fileMetadataRepository.delete(metadata);
    }

    public boolean canAccessFile(User user, FileMetadata metadata) {
        if (metadata.getOwner().getId().equals(user.getId())) {
            return true;
        }
        if (metadata.isShared()) {
            return true;
        }
        if (metadata.getConversation() != null) {
            return conversationMemberRepository.existsByConversationIdAndUserId(
                    metadata.getConversation().getId(), user.getId()
            );
        }
        return false;
    }

    public FileDto toDto(FileMetadata entity) {
        if (entity == null) return null;

        UserDto ownerDto = null;
        if (entity.getOwner() != null) {
            ownerDto = UserDto.builder()
                    .id(entity.getOwner().getId())
                    .name(entity.getOwner().getName())
                    .email(entity.getOwner().getEmail())
                    .build();
        }

        String downloadUrl = "/api/files/" + entity.getId() + "/download";
        String directUrl = storageService.getDirectDownloadUrl(entity);
        if (directUrl != null) {
            downloadUrl = directUrl;
        }

        return FileDto.builder()
                .id(entity.getId())
                .originalFilename(entity.getOriginalFilename())
                .storageKey(entity.getStorageKey())
                .mimeType(entity.getMimeType())
                .fileSize(entity.getFileSize())
                .storageType(entity.getStorageType().name())
                .owner(ownerDto)
                .conversationId(entity.getConversation() != null ? entity.getConversation().getId() : null)
                .messageId(entity.getMessage() != null ? entity.getMessage().getId() : null)
                .isShared(entity.isShared())
                .createdAt(entity.getCreatedAt())
                .downloadUrl(downloadUrl)
                .build();
    }
}
