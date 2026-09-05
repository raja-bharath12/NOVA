package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MessageRead;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageReadRepository extends JpaRepository<MessageRead, Long> {

    Optional<MessageRead> findByMessageIdAndUserId(Long messageId, Long userId);

    boolean existsByMessageIdAndUserId(Long messageId, Long userId);

    List<MessageRead> findByMessageId(Long messageId);
}
