package com.mystic.workspace.repository;

import com.mystic.workspace.entity.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {

    Optional<ConversationMember> findByConversationIdAndUserId(Long conversationId, Long userId);

    List<ConversationMember> findByConversationId(Long conversationId);

    boolean existsByConversationIdAndUserId(Long conversationId, Long userId);

    void deleteByConversationIdAndUserId(Long conversationId, Long userId);
}
