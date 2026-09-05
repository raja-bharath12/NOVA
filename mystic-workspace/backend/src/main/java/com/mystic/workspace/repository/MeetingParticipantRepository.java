package com.mystic.workspace.repository;

import com.mystic.workspace.entity.MeetingParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingParticipantRepository extends JpaRepository<MeetingParticipant, Long> {

    List<MeetingParticipant> findByMeetingId(Long meetingId);

    Optional<MeetingParticipant> findByMeetingIdAndUserIdAndLeftAtIsNull(Long meetingId, Long userId);
}
