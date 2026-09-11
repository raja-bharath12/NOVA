package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MusicRoom;
import com.mystic.workspace.entity.MusicRoomMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicRoomMessageRepository extends JpaRepository<MusicRoomMessage, Long> {
    List<MusicRoomMessage> findByRoomOrderByCreatedAtAsc(MusicRoom room);
}
