package com.mystic.workspace.controller;

import com.mystic.workspace.dto.AddMemberRequest;
import com.mystic.workspace.dto.ConversationDto;
import com.mystic.workspace.dto.CreateConversationRequest;
import com.mystic.workspace.dto.UserDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.ConversationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;
    private final UserRepository userRepository;

    @GetMapping
    public List<ConversationDto> getConversations(@AuthenticationPrincipal UserPrincipal principal) {
        return conversationService.getUserConversations(currentUser(principal));
    }

    @GetMapping("/{id}")
    public ConversationDto getConversation(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        return conversationService.getConversation(currentUser(principal), id);
    }

    @PostMapping
    public ConversationDto createConversation(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateConversationRequest request
    ) {
        return conversationService.createConversation(currentUser(principal), request);
    }

    @PostMapping("/{id}/members")
    public ConversationDto addMembers(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody AddMemberRequest request
    ) {
        return conversationService.addMembers(currentUser(principal), id, request);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long userId
    ) {
        conversationService.removeMember(currentUser(principal), id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    public List<UserDto> searchUsers(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(value = "query", required = false) String query
    ) {
        return conversationService.searchUsers(currentUser(principal), query);
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
