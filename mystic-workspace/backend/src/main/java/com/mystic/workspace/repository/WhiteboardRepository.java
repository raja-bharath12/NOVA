package com.mystic.workspace.repository;

import com.mystic.workspace.entity.Whiteboard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WhiteboardRepository extends JpaRepository<Whiteboard, Long> {

    List<Whiteboard> findByOwnerIdOrderByUpdatedAtDesc(Long ownerId);

    Optional<Whiteboard> findByMeetingId(Long meetingId);

    @Query("SELECT w FROM Whiteboard w WHERE w.meeting.roomCode = :roomCode")
    Optional<Whiteboard> findByMeetingRoomCode(@Param("roomCode") String roomCode);

    @Query("SELECT w FROM Whiteboard w WHERE w.owner.id = :ownerId AND LOWER(w.title) LIKE LOWER(CONCAT('%', :query, '%'))")
    List<Whiteboard> searchByTitle(@Param("ownerId") Long ownerId, @Param("query") String query);
}
