package com.mystic.workspace.service;

import com.mystic.workspace.dto.SaveWhiteboardRequest;
import com.mystic.workspace.dto.UserDto;
import com.mystic.workspace.dto.WhiteboardDto;
import com.mystic.workspace.entity.Meeting;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.Whiteboard;
import com.mystic.workspace.repository.MeetingRepository;
import com.mystic.workspace.repository.WhiteboardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WhiteboardService {

    private final WhiteboardRepository whiteboardRepository;
    private final MeetingRepository meetingRepository;

    @Transactional(readOnly = true)
    public List<WhiteboardDto> getUserWhiteboards(User currentUser) {
        return whiteboardRepository.findByOwnerIdOrderByUpdatedAtDesc(currentUser.getId()).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WhiteboardDto getWhiteboard(User currentUser, Long id) {
        Whiteboard board = whiteboardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Whiteboard not found"));

        return toDto(board);
    }

    @Transactional
    public WhiteboardDto getOrCreateMeetingWhiteboard(User currentUser, String roomCode) {
        Optional<Whiteboard> existing = whiteboardRepository.findByMeetingRoomCode(roomCode);
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        Meeting meeting = meetingRepository.findByRoomCode(roomCode).orElse(null);

        Whiteboard newBoard = Whiteboard.builder()
                .title(meeting != null ? meeting.getTitle() + " - Whiteboard" : "Meeting Whiteboard (" + roomCode + ")")
                .dataJson("[]")
                .owner(currentUser)
                .meeting(meeting)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        Whiteboard saved = whiteboardRepository.save(newBoard);
        return toDto(saved);
    }

    @Transactional
    public WhiteboardDto saveWhiteboard(User currentUser, SaveWhiteboardRequest request) {
        Whiteboard board;

        if (request.getId() != null) {
            board = whiteboardRepository.findById(request.getId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Whiteboard not found"));

            board.setTitle(request.getTitle());
            if (request.getDataJson() != null) {
                board.setDataJson(request.getDataJson());
            }
            board.setUpdatedAt(Instant.now());
        } else {
            Meeting meeting = null;
            if (request.getMeetingRoomCode() != null && !request.getMeetingRoomCode().isBlank()) {
                meeting = meetingRepository.findByRoomCode(request.getMeetingRoomCode()).orElse(null);
            }

            board = Whiteboard.builder()
                    .title(request.getTitle().trim())
                    .dataJson(request.getDataJson() != null ? request.getDataJson() : "[]")
                    .owner(currentUser)
                    .meeting(meeting)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
        }

        Whiteboard saved = whiteboardRepository.save(board);
        return toDto(saved);
    }

    @Transactional
    public void deleteWhiteboard(User currentUser, Long id) {
        Whiteboard board = whiteboardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Whiteboard not found"));

        if (!board.getOwner().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the board owner can delete this whiteboard");
        }

        whiteboardRepository.delete(board);
    }

    public WhiteboardDto toDto(Whiteboard entity) {
        if (entity == null) return null;

        User owner = entity.getOwner();
        UserDto ownerDto = UserDto.builder()
                .id(owner.getId())
                .name(owner.getName())
                .email(owner.getEmail())
                .userTag(owner.getUserTag())
                .build();

        return WhiteboardDto.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .dataJson(entity.getDataJson())
                .owner(ownerDto)
                .meetingId(entity.getMeeting() != null ? entity.getMeeting().getId() : null)
                .meetingRoomCode(entity.getMeeting() != null ? entity.getMeeting().getRoomCode() : null)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
