package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MusicRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MusicRoomRepository extends JpaRepository<MusicRoom, Long> {
    Optional<MusicRoom> findByRoomCode(String roomCode);
    boolean existsByRoomCode(String roomCode);
}
