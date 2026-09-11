package com.mystic.workspace.repository;

import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.WatchRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchRoomRepository extends JpaRepository<WatchRoom, Long> {
    Optional<WatchRoom> findByRoomCode(String roomCode);
    List<WatchRoom> findByHostOrderByCreatedAtDesc(User host);
    List<WatchRoom> findByStatusOrderByCreatedAtDesc(WatchRoom.Status status);
}
