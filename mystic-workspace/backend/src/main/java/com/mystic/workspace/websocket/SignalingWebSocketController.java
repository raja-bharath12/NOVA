package com.mystic.workspace.websocket;

import com.mystic.workspace.dto.CallSignalDto;
import com.mystic.workspace.dto.MeetingSignalDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Instant;

@Controller
@RequiredArgsConstructor
@Slf4j
public class SignalingWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    /**
     * WebRTC 1-to-1 Audio/Video Call Signaling.
     * Routes offer, answer, ice-candidates, call-request, accept, reject directly to target user.
     */
    @MessageMapping("/call.signal")
    public void handleCallSignal(@Payload CallSignalDto signal, Principal principal) {
        User sender = extractUser(principal);
        if (sender == null || signal.getTargetUserId() == null) return;

        signal.setSenderId(sender.getId());
        signal.setSenderName(sender.getName());

        userRepository.findById(signal.getTargetUserId()).ifPresent(targetUser -> {
            try {
                // Send to target user's private queue: /user/{email}/queue/call.signal
                messagingTemplate.convertAndSendToUser(targetUser.getEmail(), "/queue/call.signal", signal);
            } catch (Exception e) {
                log.error("Failed to route call signal from {} to {}: {}", sender.getId(), targetUser.getId(), e.getMessage());
            }
        });
    }

    /**
     * WebRTC Meeting Room Mesh Signaling.
     * Broadcasts join, leave, screen-share, hand-raise, offer, answer, ice-candidates to /topic/meeting.{roomCode}.signal
     */
    @MessageMapping("/meeting.signal")
    public void handleMeetingSignal(@Payload MeetingSignalDto signal, Principal principal) {
        User sender = extractUser(principal);
        if (sender == null || signal.getRoomCode() == null) return;

        signal.setSenderId(sender.getId());
        signal.setSenderName(sender.getName());
        signal.setTimestamp(Instant.now());

        try {
            messagingTemplate.convertAndSend(
                    "/topic/meeting." + signal.getRoomCode() + ".signal",
                    signal
            );
        } catch (Exception e) {
            log.error("Failed to broadcast meeting signal in room {}: {}", signal.getRoomCode(), e.getMessage());
        }
    }

    /**
     * WebRTC Meeting Room In-Call Live Chat.
     */
    @MessageMapping("/meeting.chat")
    public void handleMeetingChat(@Payload MeetingSignalDto signal, Principal principal) {
        User sender = extractUser(principal);
        if (sender == null || signal.getRoomCode() == null) return;

        signal.setType(MeetingSignalDto.Type.CHAT_MESSAGE);
        signal.setSenderId(sender.getId());
        signal.setSenderName(sender.getName());
        signal.setTimestamp(Instant.now());

        try {
            messagingTemplate.convertAndSend(
                    "/topic/meeting." + signal.getRoomCode() + ".chat",
                    signal
            );
        } catch (Exception e) {
            log.error("Failed to broadcast meeting chat in room {}: {}", signal.getRoomCode(), e.getMessage());
        }
    }

    private User extractUser(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth) {
            if (auth.getPrincipal() instanceof UserPrincipal userPrincipal) {
                return userRepository.findById(userPrincipal.getId()).orElse(null);
            }
        }
        if (principal != null) {
            return userRepository.findByEmail(principal.getName()).orElse(null);
        }
        return null;
    }
}
