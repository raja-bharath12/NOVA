package com.mystic.workspace.repository;

import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.WatchRoom;
import com.mystic.workspace.entity.WatchRoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WatchRoomMemberRepository extends JpaRepository<WatchRoomMember, Long> {
    Optional<WatchRoomMember> findByRoomAndUser(WatchRoom room, User user);
    List<WatchRoomMember> findByRoomAndLeftAtIsNull(WatchRoom room);
    List<WatchRoomMember> findByRoomOrderByJoinedAtAsc(WatchRoom room);
}
