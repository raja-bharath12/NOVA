package com.mystic.workspace.controller;

import com.mystic.workspace.dto.ConnectionDto;
import com.mystic.workspace.dto.UserDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.UserConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/connections")
@RequiredArgsConstructor
public class UserConnectionController {

    private final UserConnectionService userConnectionService;
    private final UserRepository userRepository;

    @GetMapping
    public List<ConnectionDto> getAcceptedConnections(@AuthenticationPrincipal UserPrincipal principal) {
        return userConnectionService.getAcceptedConnections(currentUser(principal));
    }

    @GetMapping("/pending")
    public List<ConnectionDto> getPendingIncoming(@AuthenticationPrincipal UserPrincipal principal) {
        return userConnectionService.getPendingIncoming(currentUser(principal));
    }

    @GetMapping("/sent")
    public List<ConnectionDto> getPendingSent(@AuthenticationPrincipal UserPrincipal principal) {
        return userConnectionService.getPendingSent(currentUser(principal));
    }

    @GetMapping("/users")
    public List<UserDto> searchUsersWithStatus(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "query", required = false) String query
    ) {
        return userConnectionService.searchUsersWithConnectionStatus(currentUser(principal), query);
    }

    @PostMapping("/request/{targetUserId}")
    public ConnectionDto sendRequest(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long targetUserId
    ) {
        return userConnectionService.sendConnectionRequest(currentUser(principal), targetUserId);
    }

    @PostMapping("/request/tag/{userTag}")
    public ConnectionDto sendRequestByTag(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String userTag
    ) {
        return userConnectionService.sendConnectionRequestByTag(currentUser(principal), userTag);
    }

    @PostMapping("/{connectionId}/accept")
    public ConnectionDto acceptConnection(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long connectionId
    ) {
        return userConnectionService.acceptConnection(currentUser(principal), connectionId);
    }

    @PostMapping("/{connectionId}/decline")
    public ConnectionDto declineConnection(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long connectionId
    ) {
        return userConnectionService.declineConnection(currentUser(principal), connectionId);
    }

    @DeleteMapping("/{connectionId}")
    public ResponseEntity<Void> removeConnection(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long connectionId
    ) {
        userConnectionService.removeConnection(currentUser(principal), connectionId);
        return ResponseEntity.noContent().build();
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
