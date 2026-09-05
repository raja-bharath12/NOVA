package com.mystic.workspace.repository;

import com.mystic.workspace.entity.Meeting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingRepository extends JpaRepository<Meeting, Long> {

    Optional<Meeting> findByRoomCode(String roomCode);

    @Query("SELECT DISTINCT m FROM Meeting m LEFT JOIN m.participants p WHERE m.host.id = :userId OR p.user.id = :userId ORDER BY m.createdAt DESC")
    List<Meeting> findAllForUser(@Param("userId") Long userId);
}
