package com.mystic.workspace.repository;

import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.WatchMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WatchMediaRepository extends JpaRepository<WatchMedia, Long> {
    List<WatchMedia> findByOwnerOrderByCreatedAtDesc(User owner);
    List<WatchMedia> findByOwnerAndStatusOrderByCreatedAtDesc(User owner, WatchMedia.Status status);
}
