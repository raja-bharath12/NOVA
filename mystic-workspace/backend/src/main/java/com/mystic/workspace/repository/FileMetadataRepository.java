package com.mystic.workspace.repository;

import com.mystic.workspace.entity.FileMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadata, Long> {

    List<FileMetadata> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    List<FileMetadata> findByConversationIdOrderByCreatedAtDesc(Long conversationId);

    Optional<FileMetadata> findByStorageKey(String storageKey);

    @Query("SELECT f FROM FileMetadata f WHERE f.owner.id = :ownerId AND LOWER(f.originalFilename) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY f.createdAt DESC")
    List<FileMetadata> searchByFilename(@Param("ownerId") Long ownerId, @Param("query") String query);

    @Query("SELECT f FROM FileMetadata f WHERE f.owner.id = :ownerId AND LOWER(f.mimeType) LIKE LOWER(CONCAT(:mimePrefix, '%')) ORDER BY f.createdAt DESC")
    List<FileMetadata> findByOwnerIdAndMimeTypePrefix(@Param("ownerId") Long ownerId, @Param("mimePrefix") String mimePrefix);

    @Query("SELECT f FROM FileMetadata f WHERE (f.isShared = true OR f.conversation.id IN (SELECT m.conversation.id FROM ConversationMember m WHERE m.user.id = :userId)) AND f.owner.id <> :userId ORDER BY f.createdAt DESC")
    List<FileMetadata> findSharedWithUser(@Param("userId") Long userId);
}
