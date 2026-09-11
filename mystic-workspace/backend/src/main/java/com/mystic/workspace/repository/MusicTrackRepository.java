package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MusicTrack;
import com.mystic.workspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MusicTrackRepository extends JpaRepository<MusicTrack, Long> {
    List<MusicTrack> findByUploaderOrderByCreatedAtDesc(User uploader);
    List<MusicTrack> findAllByOrderByCreatedAtDesc();
}
