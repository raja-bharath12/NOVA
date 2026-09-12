package com.mystic.workspace.controller;

import com.mystic.workspace.dto.PushSubscriptionDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.WebPushService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping({"/api/notifications", "/notifications", "/api/api/notifications"})
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final WebPushService webPushService;
    private final UserRepository userRepository;

    @GetMapping("/vapid-public-key")
    public Map<String, String> getVapidPublicKey() {
        return Map.of("publicKey", webPushService.getVapidPublicKey());
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Map<String, Object>> subscribe(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody PushSubscriptionDto subscriptionDto
    ) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        webPushService.subscribe(user, subscriptionDto);
        return ResponseEntity.ok(Map.of("success", true, "message", "Push subscription registered"));
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Map<String, Object>> unsubscribe(
            @RequestBody Map<String, String> payload
    ) {
        String endpoint = payload != null ? payload.get("endpoint") : null;
        if (endpoint != null && !endpoint.isBlank()) {
            webPushService.unsubscribe(endpoint);
        }
        return ResponseEntity.ok(Map.of("success", true, "message", "Push subscription removed"));
    }
}
