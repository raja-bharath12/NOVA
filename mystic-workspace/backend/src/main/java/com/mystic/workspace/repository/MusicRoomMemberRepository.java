package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MusicRoom;
import com.mystic.workspace.entity.MusicRoomMember;
import com.mystic.workspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MusicRoomMemberRepository extends JpaRepository<MusicRoomMember, Long> {
    Optional<MusicRoomMember> findByRoomAndUser(MusicRoom room, User user);
    List<MusicRoomMember> findByRoomAndLeftAtIsNull(MusicRoom room);
    List<MusicRoomMember> findByRoom(MusicRoom room);
}
