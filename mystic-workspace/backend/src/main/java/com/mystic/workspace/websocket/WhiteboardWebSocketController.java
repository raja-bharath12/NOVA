package com.mystic.workspace.websocket;

import com.mystic.workspace.dto.WhiteboardOpDto;
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

@Controller
@RequiredArgsConstructor
@Slf4j
public class WhiteboardWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    @MessageMapping("/whiteboard.op")
    public void handleWhiteboardOp(@Payload WhiteboardOpDto op, Principal principal) {
        User user = extractUser(principal);
        if (user == null || (op.getBoardId() == null && op.getRoomCode() == null)) return;

        op.setUserId(user.getId());
        op.setUserName(user.getName());

        String destination = op.getBoardId() != null
                ? "/topic/whiteboard." + op.getBoardId() + ".ops"
                : "/topic/meeting." + op.getRoomCode() + ".whiteboard.ops";

        try {
            messagingTemplate.convertAndSend(destination, op);
        } catch (Exception e) {
            log.error("Failed to broadcast whiteboard op: {}", e.getMessage());
        }
    }

    @MessageMapping("/whiteboard.cursor")
    public void handleWhiteboardCursor(@Payload WhiteboardOpDto cursor, Principal principal) {
        User user = extractUser(principal);
        if (user == null || (cursor.getBoardId() == null && cursor.getRoomCode() == null)) return;

        cursor.setType(WhiteboardOpDto.Type.CURSOR_MOVE);
        cursor.setUserId(user.getId());
        cursor.setUserName(user.getName());

        String destination = cursor.getBoardId() != null
                ? "/topic/whiteboard." + cursor.getBoardId() + ".cursors"
                : "/topic/meeting." + cursor.getRoomCode() + ".whiteboard.cursors";

        try {
            messagingTemplate.convertAndSend(destination, cursor);
        } catch (Exception e) {
            log.error("Failed to broadcast whiteboard cursor: {}", e.getMessage());
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
