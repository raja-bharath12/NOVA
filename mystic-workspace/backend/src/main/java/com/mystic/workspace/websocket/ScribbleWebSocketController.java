package com.mystic.workspace.websocket;

import com.mystic.workspace.dto.ScribbleDtos.*;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.service.ScribbleGameService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ScribbleWebSocketController {

    private final ScribbleGameService scribbleService;
    private final UserRepository userRepository;

    @MessageMapping("/scribble/{roomCode}/start")
    public void handleStartGame(@DestinationVariable String roomCode, Principal principal) {
        User user = resolveUser(principal);
        if (user != null) {
            scribbleService.startGame(roomCode, user.getId());
        }
    }

    @MessageMapping("/scribble/{roomCode}/select-word")
    public void handleSelectWord(
            @DestinationVariable String roomCode,
            @Payload SelectWordRequest req,
            Principal principal
    ) {
        User user = resolveUser(principal);
        if (user != null && req != null && req.getWord() != null) {
            scribbleService.selectWord(roomCode, user.getId(), req.getWord());
        }
    }

    @MessageMapping("/scribble/{roomCode}/draw")
    public void handleDraw(
            @DestinationVariable String roomCode,
            @Payload DrawAction action,
            Principal principal
    ) {
        User user = resolveUser(principal);
        if (user != null && action != null) {
            scribbleService.handleDrawAction(roomCode, action, user.getId());
        }
    }

    @MessageMapping("/scribble/{roomCode}/guess")
    public void handleGuess(
            @DestinationVariable String roomCode,
            @Payload GuessPayload payload,
            Principal principal
    ) {
        if (payload == null || payload.getText() == null) return;
        User user = resolveUser(principal);
        scribbleService.handleGuess(roomCode, user, payload.getText(), null, null);
    }

    @MessageMapping("/scribble/{roomCode}/leave")
    public void handleLeave(@DestinationVariable String roomCode, Principal principal) {
        User user = resolveUser(principal);
        if (user != null) {
            scribbleService.leaveRoom(roomCode, user.getId());
        }
    }

    private User resolveUser(Principal principal) {
        if (principal == null) return null;
        return userRepository.findByEmail(principal.getName()).orElse(null);
    }
}
