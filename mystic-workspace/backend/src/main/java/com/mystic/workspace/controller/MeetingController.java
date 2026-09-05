package com.mystic.workspace.controller;

import com.mystic.workspace.dto.CreateMeetingRequest;
import com.mystic.workspace.dto.MeetingDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.MeetingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/meetings")
@RequiredArgsConstructor
public class MeetingController {

    private final MeetingService meetingService;
    private final UserRepository userRepository;

    @PostMapping("/instant")
    public MeetingDto createInstantMeeting(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody(required = false) CreateMeetingRequest request
    ) {
        if (request == null) {
            request = new CreateMeetingRequest();
        }
        return meetingService.createInstantMeeting(currentUser(principal), request);
    }

    @PostMapping("/schedule")
    public MeetingDto scheduleMeeting(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateMeetingRequest request
    ) {
        return meetingService.scheduleMeeting(currentUser(principal), request);
    }

    @GetMapping
    public List<MeetingDto> getUserMeetings(@AuthenticationPrincipal UserPrincipal principal) {
        return meetingService.getUserMeetings(currentUser(principal));
    }

    @GetMapping("/{roomCode}")
    public MeetingDto getMeeting(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        return meetingService.getMeetingByRoomCode(currentUser(principal), roomCode);
    }

    @PostMapping("/{roomCode}/join")
    public MeetingDto joinMeeting(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        return meetingService.joinMeeting(currentUser(principal), roomCode);
    }

    @PostMapping("/{roomCode}/leave")
    public ResponseEntity<Void> leaveMeeting(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        meetingService.leaveMeeting(currentUser(principal), roomCode);
        return ResponseEntity.ok().build();
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
