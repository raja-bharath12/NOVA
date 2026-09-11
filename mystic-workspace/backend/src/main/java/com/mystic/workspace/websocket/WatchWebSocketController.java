package com.mystic.workspace.websocket;

import com.mystic.workspace.dto.WatchChatMessageDto;
import com.mystic.workspace.dto.WatchControlSignalDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.service.WatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WatchWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final WatchService watchService;
    private final UserRepository userRepository;

    /**
     * Handles real-time video playback synchronization commands (PLAY, PAUSE, SEEK, SYNC, HOST_TRANSFER)
     */
    @MessageMapping("/watch/{roomCode}/control")
    public void handleControl(
            @DestinationVariable String roomCode,
            @Payload WatchControlSignalDto signal,
            Principal principal
    ) {
        User sender = resolveUser(principal);
        if (sender != null) {
            signal.setSenderId(sender.getId());
            signal.setSenderName(sender.getName());
        }

        signal.setRoomCode(roomCode);
        signal.setServerTimestamp(Instant.now());

        // Update authoritative room playback state in DB
        if (signal.getType() == WatchControlSignalDto.Type.PLAY) {
            watchService.updatePlaybackState(roomCode, signal.getPosition(), true, signal.getPlaybackRate());
        } else if (signal.getType() == WatchControlSignalDto.Type.PAUSE) {
            watchService.updatePlaybackState(roomCode, signal.getPosition(), false, signal.getPlaybackRate());
        } else if (signal.getType() == WatchControlSignalDto.Type.SEEK) {
            watchService.updatePlaybackState(roomCode, signal.getPosition(), signal.isPlaying(), signal.getPlaybackRate());
        } else if (signal.getType() == WatchControlSignalDto.Type.SYNC) {
            watchService.updatePlaybackState(roomCode, signal.getPosition(), signal.isPlaying(), signal.getPlaybackRate());
        }

        // Broadcast synchronized playback signal to all participants in the room
        String destination = "/topic/watch." + roomCode.trim().toLowerCase();
        messagingTemplate.convertAndSend(destination, signal);
        log.debug("Watch signal broadcast to {}: type={}, pos={}, playing={}", destination, signal.getType(), signal.getPosition(), signal.isPlaying());
    }

    /**
     * Handles real-time YouTube-Live-style chat messages in the watch room
     */
    @MessageMapping("/watch/{roomCode}/chat")
    public void handleChat(
            @DestinationVariable String roomCode,
            @Payload WatchChatMessageDto chatPayload,
            Principal principal
    ) {
        User sender = resolveUser(principal);
        if (sender == null || chatPayload.getContent() == null || chatPayload.getContent().isBlank()) {
            return;
        }

        WatchChatMessageDto savedMsg = watchService.saveChatMessage(sender, roomCode, chatPayload.getContent());

        WatchControlSignalDto signal = WatchControlSignalDto.builder()
                .type(WatchControlSignalDto.Type.CHAT_MESSAGE)
                .roomCode(roomCode.trim().toLowerCase())
                .senderId(sender.getId())
                .senderName(sender.getName())
                .serverTimestamp(Instant.now())
                .payload(savedMsg)
                .build();

        String destination = "/topic/watch." + roomCode.trim().toLowerCase();
        messagingTemplate.convertAndSend(destination, signal);
        log.debug("Watch chat message broadcast to {}: sender={}, msg={}", destination, sender.getName(), savedMsg.getContent());
    }

    /**
     * Handles participant presence updates (JOIN / LEAVE)
     */
    @MessageMapping("/watch/{roomCode}/presence")
    public void handlePresence(
            @DestinationVariable String roomCode,
            @Payload WatchControlSignalDto signal,
            Principal principal
    ) {
        User sender = resolveUser(principal);
        if (sender != null) {
            signal.setSenderId(sender.getId());
            signal.setSenderName(sender.getName());
        }
        signal.setRoomCode(roomCode.trim().toLowerCase());
        signal.setServerTimestamp(Instant.now());

        String destination = "/topic/watch." + roomCode.trim().toLowerCase();
        messagingTemplate.convertAndSend(destination, signal);
    }

    private User resolveUser(Principal principal) {
        if (principal == null) return null;
        return userRepository.findByEmail(principal.getName()).orElse(null);
    }
}
