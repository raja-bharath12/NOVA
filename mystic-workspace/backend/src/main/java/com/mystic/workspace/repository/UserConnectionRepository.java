package com.mystic.workspace.repository;

import com.mystic.workspace.entity.UserConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserConnectionRepository extends JpaRepository<UserConnection, Long> {

    @Query("SELECT c FROM UserConnection c WHERE " +
           "(c.requester.id = :u1 AND c.recipient.id = :u2) OR " +
           "(c.requester.id = :u2 AND c.recipient.id = :u1)")
    Optional<UserConnection> findConnectionBetween(@Param("u1") Long u1, @Param("u2") Long u2);

    List<UserConnection> findByRecipientIdAndStatus(Long recipientId, UserConnection.Status status);

    List<UserConnection> findByRequesterIdAndStatus(Long requesterId, UserConnection.Status status);

    @Query("SELECT c FROM UserConnection c WHERE " +
           "(c.requester.id = :userId OR c.recipient.id = :userId) AND c.status = :status")
    List<UserConnection> findAllAcceptedForUser(@Param("userId") Long userId, @Param("status") UserConnection.Status status);

    @Query("SELECT c FROM UserConnection c WHERE c.requester.id = :userId OR c.recipient.id = :userId")
    List<UserConnection> findAllForUser(@Param("userId") Long userId);
}
