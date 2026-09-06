package com.mystic.workspace.service;

import com.mystic.workspace.dto.*;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MeetingService {

    private final MeetingRepository meetingRepository;
    private final MeetingParticipantRepository meetingParticipantRepository;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public MeetingDto createInstantMeeting(User currentUser, CreateMeetingRequest request) {
        String roomCode = generateRoomCode();
        String title = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle().trim()
                : currentUser.getName() + "'s Meeting";

        Meeting meeting = Meeting.builder()
                .roomCode(roomCode)
                .title(title)
                .description(request.getDescription())
                .host(currentUser)
                .status(Meeting.Status.ACTIVE)
                .createdAt(Instant.now())
                .startedAt(Instant.now())
                .build();

        Meeting saved = meetingRepository.save(meeting);

        MeetingParticipant participant = MeetingParticipant.builder()
                .meeting(saved)
                .user(currentUser)
                .role(MeetingParticipant.Role.HOST)
                .joinedAt(Instant.now())
                .build();

        meetingParticipantRepository.save(participant);

        return toDto(saved);
    }

    @Transactional
    public MeetingDto scheduleMeeting(User currentUser, CreateMeetingRequest request) {
        String roomCode = generateRoomCode();
        String title = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle().trim()
                : "Scheduled Meeting";

        Meeting meeting = Meeting.builder()
                .roomCode(roomCode)
                .title(title)
                .description(request.getDescription())
                .host(currentUser)
                .scheduledStartTime(request.getScheduledStartTime())
                .status(Meeting.Status.WAITING)
                .createdAt(Instant.now())
                .build();

        Meeting saved = meetingRepository.save(meeting);

        MeetingParticipant participant = MeetingParticipant.builder()
                .meeting(saved)
                .user(currentUser)
                .role(MeetingParticipant.Role.HOST)
                .joinedAt(Instant.now())
                .build();

        meetingParticipantRepository.save(participant);

        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<MeetingDto> getUserMeetings(User currentUser) {
        return meetingRepository.findAllForUser(currentUser.getId()).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public MeetingDto getMeetingByRoomCode(User currentUser, String roomCode) {
        Meeting meeting = meetingRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting room not found"));

        return toDto(meeting);
    }

    @Transactional
    public MeetingDto joinMeeting(User currentUser, String roomCode) {
        Meeting meeting = meetingRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting room not found"));

        if (meeting.getStatus() == Meeting.Status.ENDED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This meeting has already ended");
        }

        if (meeting.getStatus() == Meeting.Status.WAITING) {
            meeting.setStatus(Meeting.Status.ACTIVE);
            meeting.setStartedAt(Instant.now());
            meetingRepository.save(meeting);
        }

        boolean alreadyParticipant = meetingParticipantRepository
                .findByMeetingIdAndUserIdAndLeftAtIsNull(meeting.getId(), currentUser.getId())
                .isPresent();

        if (!alreadyParticipant) {
            MeetingParticipant participant = MeetingParticipant.builder()
                    .meeting(meeting)
                    .user(currentUser)
                    .role(meeting.getHost().getId().equals(currentUser.getId()) ? MeetingParticipant.Role.HOST : MeetingParticipant.Role.PARTICIPANT)
                    .joinedAt(Instant.now())
                    .build();
            meetingParticipantRepository.save(participant);
        }

        return toDto(meeting);
    }

    @Transactional
    public void leaveMeeting(User currentUser, String roomCode) {
        Meeting meeting = meetingRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        meetingParticipantRepository.findByMeetingIdAndUserIdAndLeftAtIsNull(meeting.getId(), currentUser.getId())
                .ifPresent(p -> {
                    p.setLeftAt(Instant.now());
                    meetingParticipantRepository.save(p);
                });
    }

    private String generateRoomCode() {
        String chars = "abcdefghijklmnopqrstuvwxyz";
        StringBuilder sb = new StringBuilder("nova-");
        for (int i = 0; i < 3; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
        sb.append("-");
        for (int i = 0; i < 3; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
        return sb.toString();
    }

    public MeetingDto toDto(Meeting entity) {
        if (entity == null) return null;

        User host = entity.getHost();
        UserDto hostDto = UserDto.builder()
                .id(host.getId())
                .name(host.getName())
                .email(host.getEmail())
                .userTag(host.getUserTag())
                .build();

        List<MeetingParticipantDto> participantDtos = meetingParticipantRepository.findByMeetingId(entity.getId()).stream()
                .map(p -> MeetingParticipantDto.builder()
                        .id(p.getId())
                        .user(UserDto.builder()
                                .id(p.getUser().getId())
                                .name(p.getUser().getName())
                                .email(p.getUser().getEmail())
                                .userTag(p.getUser().getUserTag())
                                .build())
                        .role(p.getRole().name())
                        .joinedAt(p.getJoinedAt())
                        .leftAt(p.getLeftAt())
                        .build())
                .collect(Collectors.toList());

        return MeetingDto.builder()
                .id(entity.getId())
                .roomCode(entity.getRoomCode())
                .title(entity.getTitle())
                .description(entity.getDescription())
                .host(hostDto)
                .scheduledStartTime(entity.getScheduledStartTime())
                .status(entity.getStatus().name())
                .createdAt(entity.getCreatedAt())
                .startedAt(entity.getStartedAt())
                .endedAt(entity.getEndedAt())
                .participants(participantDtos)
                .build();
    }
}
