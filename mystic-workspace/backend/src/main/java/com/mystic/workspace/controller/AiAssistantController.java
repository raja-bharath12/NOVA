package com.mystic.workspace.controller;

import com.mystic.workspace.dto.*;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.AiAssistantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiAssistantController {

    private final AiAssistantService aiAssistantService;
    private final UserRepository userRepository;

    @PostMapping("/chat")
    public AiChatResponse chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody AiChatRequest request
    ) {
        return aiAssistantService.processPrompt(currentUser(principal), request);
    }

    @PostMapping("/create-tasks")
    public List<TaskDto> createSuggestedTasks(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateSuggestedTasksRequest request
    ) {
        return aiAssistantService.createSuggestedTasks(currentUser(principal), request);
    }

    @GetMapping("/analytics")
    public AiProductivityAnalyticsDto getAnalytics(@AuthenticationPrincipal UserPrincipal principal) {
        return aiAssistantService.getAnalytics(currentUser(principal));
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
