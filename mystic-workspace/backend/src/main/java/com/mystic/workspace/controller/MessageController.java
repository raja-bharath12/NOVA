package com.mystic.workspace.controller;

import com.mystic.workspace.dto.EditMessageRequest;
import com.mystic.workspace.dto.MessageDto;
import com.mystic.workspace.dto.SendMessageRequest;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;

    @GetMapping("/api/conversations/{conversationId}/messages")
    public List<MessageDto> getMessages(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long conversationId,
            @RequestParam(value = "query", required = false) String query
    ) {
        return messageService.getMessages(currentUser(principal), conversationId, query);
    }

    @PostMapping("/api/conversations/{conversationId}/messages")
    public MessageDto sendMessage(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long conversationId,
            @Valid @RequestBody SendMessageRequest request
    ) {
        return messageService.sendMessage(currentUser(principal), conversationId, request);
    }

    @PutMapping("/api/messages/{id}")
    public MessageDto editMessage(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody EditMessageRequest request
    ) {
        return messageService.editMessage(currentUser(principal), id, request);
    }

    @DeleteMapping("/api/messages/{id}")
    public ResponseEntity<Void> deleteMessage(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        messageService.deleteMessage(currentUser(principal), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/conversations/{conversationId}/messages/{id}/read")
    public ResponseEntity<Void> markAsRead(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long conversationId,
            @PathVariable Long id
    ) {
        messageService.markMessageAsRead(currentUser(principal), conversationId, id);
        return ResponseEntity.ok().build();
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
