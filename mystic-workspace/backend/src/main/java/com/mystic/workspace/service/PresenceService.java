package com.mystic.workspace.service;

import com.mystic.workspace.dto.PresenceNotification;
import com.mystic.workspace.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    // Map: userId -> Status (ONLINE, AWAY, OFFLINE)
    private final Map<Long, String> userStatusMap = new ConcurrentHashMap<>();
    // Map: userId -> Active WebSocket Session Count
    private final Map<Long, Integer> userSessionCount = new ConcurrentHashMap<>();

    public void userConnected(User user) {
        if (user == null || user.getId() == null) return;
        Long userId = user.getId();

        userSessionCount.compute(userId, (k, v) -> (v == null) ? 1 : v + 1);
        userStatusMap.put(userId, "ONLINE");

        broadcastPresence(userId, user.getName(), "ONLINE");
    }

    public void userDisconnected(User user) {
        if (user == null || user.getId() == null) return;
        Long userId = user.getId();

        Integer remaining = userSessionCount.compute(userId, (k, v) -> {
            if (v == null || v <= 1) return null;
            return v - 1;
        });

        if (remaining == null) {
            userStatusMap.put(userId, "OFFLINE");
            broadcastPresence(userId, user.getName(), "OFFLINE");
        }
    }

    public void updateUserStatus(User user, String status) {
        if (user == null || user.getId() == null) return;
        Long userId = user.getId();
        userStatusMap.put(userId, status);
        broadcastPresence(userId, user.getName(), status);
    }

    public String getUserStatus(Long userId) {
        return userStatusMap.getOrDefault(userId, "OFFLINE");
    }

    public Map<Long, String> getAllStatuses() {
        return new ConcurrentHashMap<>(userStatusMap);
    }

    private void broadcastPresence(Long userId, String userName, String status) {
        try {
            PresenceNotification notification = PresenceNotification.builder()
                    .userId(userId)
                    .userName(userName)
                    .status(status)
                    .timestamp(Instant.now())
                    .build();

            messagingTemplate.convertAndSend("/topic/presence", notification);
        } catch (Exception e) {
            log.error("Failed to broadcast presence for user {}: {}", userId, e.getMessage());
        }
    }
}
