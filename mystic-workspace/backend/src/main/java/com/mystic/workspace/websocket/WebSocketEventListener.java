package com.mystic.workspace.websocket;

import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {

    private final PresenceService presenceService;
    private final UserRepository userRepository;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        User user = extractUser(principal);
        if (user != null) {
            log.info("User connected to WebSocket: {} ({})", user.getName(), user.getEmail());
            presenceService.userConnected(user);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        User user = extractUser(principal);
        if (user != null) {
            log.info("User disconnected from WebSocket: {} ({})", user.getName(), user.getEmail());
            presenceService.userDisconnected(user);
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
