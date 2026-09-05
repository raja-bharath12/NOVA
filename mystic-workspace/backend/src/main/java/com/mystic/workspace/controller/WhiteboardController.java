package com.mystic.workspace.controller;

import com.mystic.workspace.dto.SaveWhiteboardRequest;
import com.mystic.workspace.dto.WhiteboardDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.WhiteboardService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/whiteboards")
@RequiredArgsConstructor
public class WhiteboardController {

    private final WhiteboardService whiteboardService;
    private final UserRepository userRepository;

    @GetMapping
    public List<WhiteboardDto> getUserWhiteboards(@AuthenticationPrincipal UserPrincipal principal) {
        return whiteboardService.getUserWhiteboards(currentUser(principal));
    }

    @GetMapping("/{id}")
    public WhiteboardDto getWhiteboard(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        return whiteboardService.getWhiteboard(currentUser(principal), id);
    }

    @GetMapping("/meeting/{roomCode}")
    public WhiteboardDto getMeetingWhiteboard(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        return whiteboardService.getOrCreateMeetingWhiteboard(currentUser(principal), roomCode);
    }

    @PostMapping
    public WhiteboardDto saveWhiteboard(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody SaveWhiteboardRequest request
    ) {
        return whiteboardService.saveWhiteboard(currentUser(principal), request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWhiteboard(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        whiteboardService.deleteWhiteboard(currentUser(principal), id);
        return ResponseEntity.noContent().build();
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
