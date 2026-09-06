package com.mystic.workspace.service;

import com.mystic.workspace.dto.ConnectionDto;
import com.mystic.workspace.dto.UserDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.UserConnection;
import com.mystic.workspace.repository.UserConnectionRepository;
import com.mystic.workspace.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserConnectionService {

    private final UserConnectionRepository userConnectionRepository;
    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public ConnectionDto sendConnectionRequest(User currentUser, Long targetUserId) {
        if (currentUser.getId().equals(targetUserId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot send connection request to yourself");
        }

        User recipient = userRepository.findById(targetUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target user not found"));

        Optional<UserConnection> existingOpt = userConnectionRepository.findConnectionBetween(currentUser.getId(), recipient.getId());

        UserConnection connection;
        if (existingOpt.isPresent()) {
            connection = existingOpt.get();
            if (connection.getStatus() == UserConnection.Status.ACCEPTED) {
                return toDto(connection);
            }
            if (connection.getStatus() == UserConnection.Status.PENDING) {
                // If the other user already sent a pending request to current user, auto-accept it!
                if (connection.getRecipient().getId().equals(currentUser.getId())) {
                    return acceptConnection(currentUser, connection.getId());
                }
                return toDto(connection);
            }
            // If DECLINED, reset to PENDING with current user as requester
            connection.setRequester(currentUser);
            connection.setRecipient(recipient);
            connection.setStatus(UserConnection.Status.PENDING);
            connection.setUpdatedAt(Instant.now());
            connection = userConnectionRepository.save(connection);
        } else {
            connection = UserConnection.builder()
                    .requester(currentUser)
                    .recipient(recipient)
                    .status(UserConnection.Status.PENDING)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            connection = userConnectionRepository.save(connection);
        }

        ConnectionDto dto = toDto(connection);

        // Notify recipient via private STOMP queue
        notifyUserConnectionEvent(recipient.getEmail(), "CONNECTION_REQUEST", dto);

        return dto;
    }

    @Transactional
    public ConnectionDto sendConnectionRequestByTag(User currentUser, String userTag) {
        if (userTag == null || userTag.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User Tag is required");
        }

        String normalizedTag = userTag.trim().toUpperCase();
        User recipient = userRepository.findByUserTagIgnoreCase(normalizedTag)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No user found with Chat ID: " + userTag.trim()));

        return sendConnectionRequest(currentUser, recipient.getId());
    }

    @Transactional
    public ConnectionDto acceptConnection(User currentUser, Long connectionId) {
        UserConnection connection = userConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection request not found"));

        if (!connection.getRecipient().getId().equals(currentUser.getId()) && !connection.getRequester().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to accept this connection request");
        }

        connection.setStatus(UserConnection.Status.ACCEPTED);
        connection.setUpdatedAt(Instant.now());
        UserConnection saved = userConnectionRepository.save(connection);

        ConnectionDto dto = toDto(saved);

        // Notify both users about the accepted connection
        notifyUserConnectionEvent(saved.getRequester().getEmail(), "CONNECTION_ACCEPTED", dto);
        notifyUserConnectionEvent(saved.getRecipient().getEmail(), "CONNECTION_ACCEPTED", dto);

        return dto;
    }

    @Transactional
    public ConnectionDto declineConnection(User currentUser, Long connectionId) {
        UserConnection connection = userConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection request not found"));

        if (!connection.getRecipient().getId().equals(currentUser.getId()) && !connection.getRequester().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to decline this connection request");
        }

        connection.setStatus(UserConnection.Status.DECLINED);
        connection.setUpdatedAt(Instant.now());
        UserConnection saved = userConnectionRepository.save(connection);

        ConnectionDto dto = toDto(saved);
        notifyUserConnectionEvent(saved.getRequester().getEmail(), "CONNECTION_DECLINED", dto);

        return dto;
    }

    @Transactional
    public void removeConnection(User currentUser, Long connectionId) {
        UserConnection connection = userConnectionRepository.findById(connectionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Connection not found"));

        if (!connection.getRequester().getId().equals(currentUser.getId()) && !connection.getRecipient().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to remove this connection");
        }

        userConnectionRepository.delete(connection);
    }

    @Transactional(readOnly = true)
    public List<ConnectionDto> getPendingIncoming(User currentUser) {
        return userConnectionRepository.findByRecipientIdAndStatus(currentUser.getId(), UserConnection.Status.PENDING)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ConnectionDto> getPendingSent(User currentUser) {
        return userConnectionRepository.findByRequesterIdAndStatus(currentUser.getId(), UserConnection.Status.PENDING)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ConnectionDto> getAcceptedConnections(User currentUser) {
        return userConnectionRepository.findAllAcceptedForUser(currentUser.getId(), UserConnection.Status.ACCEPTED)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDto> searchUsersWithConnectionStatus(User currentUser, String query) {
        String q = (query != null) ? query.trim().toLowerCase() : "";

        // Fetch all connections involving current user
        List<UserConnection> userConnections = userConnectionRepository.findAllForUser(currentUser.getId());
        Map<Long, UserConnection> connectionByOtherUserId = new HashMap<>();

        for (UserConnection conn : userConnections) {
            Long otherUserId = conn.getRequester().getId().equals(currentUser.getId())
                    ? conn.getRecipient().getId()
                    : conn.getRequester().getId();
            connectionByOtherUserId.put(otherUserId, conn);
        }

        List<User> users = userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .filter(u -> q.isEmpty() ||
                        (u.getName() != null && u.getName().toLowerCase().contains(q)) ||
                        (u.getEmail() != null && u.getEmail().toLowerCase().contains(q)) ||
                        (u.getUserTag() != null && u.getUserTag().toLowerCase().contains(q)))
                .collect(Collectors.toList());

        return users.stream().map(u -> {
            UserConnection conn = connectionByOtherUserId.get(u.getId());
            String connStatus = "NONE";
            Long connId = null;

            if (conn != null) {
                connId = conn.getId();
                if (conn.getStatus() == UserConnection.Status.ACCEPTED) {
                    connStatus = "CONNECTED";
                } else if (conn.getStatus() == UserConnection.Status.PENDING) {
                    if (conn.getRequester().getId().equals(currentUser.getId())) {
                        connStatus = "PENDING_SENT";
                    } else {
                        connStatus = "PENDING_RECEIVED";
                    }
                } else {
                    connStatus = "NONE";
                }
            }

            return UserDto.builder()
                    .id(u.getId())
                    .name(u.getName())
                    .email(u.getEmail())
                    .userTag(u.getUserTag())
                    .status(presenceService.getUserStatus(u.getId()))
                    .connectionStatus(connStatus)
                    .connectionId(connId)
                    .build();
        }).collect(Collectors.toList());
    }

    public boolean areUsersConnected(Long user1Id, Long user2Id) {
        if (user1Id.equals(user2Id)) return true;
        return userConnectionRepository.findConnectionBetween(user1Id, user2Id)
                .map(c -> c.getStatus() == UserConnection.Status.ACCEPTED)
                .orElse(false);
    }

    private void notifyUserConnectionEvent(String userEmail, String eventType, ConnectionDto dto) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("type", eventType);
            payload.put("connection", dto);
            payload.put("timestamp", Instant.now().toString());

            messagingTemplate.convertAndSendToUser(userEmail, "/queue/connections", payload);
            messagingTemplate.convertAndSendToUser(userEmail, "/queue/notifications", payload);
        } catch (Exception e) {
            log.error("Failed to notify user {} about connection event {}: {}", userEmail, eventType, e.getMessage());
        }
    }

    public ConnectionDto toDto(UserConnection entity) {
        if (entity == null) return null;

        return ConnectionDto.builder()
                .id(entity.getId())
                .requester(UserDto.builder()
                        .id(entity.getRequester().getId())
                        .name(entity.getRequester().getName())
                        .email(entity.getRequester().getEmail())
                        .userTag(entity.getRequester().getUserTag())
                        .status(presenceService.getUserStatus(entity.getRequester().getId()))
                        .build())
                .recipient(UserDto.builder()
                        .id(entity.getRecipient().getId())
                        .name(entity.getRecipient().getName())
                        .email(entity.getRecipient().getEmail())
                        .userTag(entity.getRecipient().getUserTag())
                        .status(presenceService.getUserStatus(entity.getRecipient().getId()))
                        .build())
                .status(entity.getStatus().name())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
