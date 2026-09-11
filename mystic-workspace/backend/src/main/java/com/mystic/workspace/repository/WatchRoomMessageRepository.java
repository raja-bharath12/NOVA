package com.mystic.workspace.repository;

import com.mystic.workspace.entity.WatchRoom;
import com.mystic.workspace.entity.WatchRoomMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WatchRoomMessageRepository extends JpaRepository<WatchRoomMessage, Long> {
    List<WatchRoomMessage> findByRoomOrderByCreatedAtAsc(WatchRoom room);
    List<WatchRoomMessage> findTop50ByRoomOrderByCreatedAtDesc(WatchRoom room);
}
