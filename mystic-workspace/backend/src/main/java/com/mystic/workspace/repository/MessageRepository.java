package com.mystic.workspace.repository;

import com.mystic.workspace.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByConversationIdOrderByCreatedAtAsc(Long conversationId);

    List<Message> findByConversationIdOrderByCreatedAtDesc(Long conversationId, Pageable pageable);

    Optional<Message> findTopByConversationIdOrderByCreatedAtDesc(Long conversationId);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.conversation.id = :conversationId AND m.createdAt > :since AND m.sender.id <> :userId AND m.isDeleted = false")
    long countUnreadMessages(@Param("conversationId") Long conversationId, @Param("since") Instant since, @Param("userId") Long userId);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :conversationId AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) AND m.isDeleted = false ORDER BY m.createdAt DESC")
    List<Message> searchMessages(@Param("conversationId") Long conversationId, @Param("query") String query);

    @Query("SELECT m FROM Message m JOIN m.conversation.members mem WHERE mem.user.id = :userId AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) AND m.isDeleted = false ORDER BY m.createdAt DESC")
    List<Message> searchAllMessagesForUser(@Param("userId") Long userId, @Param("query") String query);
}
