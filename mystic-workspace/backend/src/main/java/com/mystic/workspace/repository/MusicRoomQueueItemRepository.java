package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MusicRoom;
import com.mystic.workspace.entity.MusicRoomQueueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicRoomQueueItemRepository extends JpaRepository<MusicRoomQueueItem, Long> {
    List<MusicRoomQueueItem> findByRoomOrderByOrderIndexAsc(MusicRoom room);
    void deleteByRoom(MusicRoom room);
}
