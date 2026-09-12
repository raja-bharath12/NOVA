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
        scribbleService.startGame(roomCode, user != null ? user.getId() : null);
    }

    @MessageMapping("/scribble/{roomCode}/select-word")
    public void handleSelectWord(
            @DestinationVariable String roomCode,
            @Payload SelectWordRequest req,
            Principal principal
    ) {
        User user = resolveUser(principal);
        if (req != null && req.getWord() != null) {
            scribbleService.selectWord(roomCode, user != null ? user.getId() : null, req.getWord());
        }
    }

    @MessageMapping("/scribble/{roomCode}/draw")
    public void handleDraw(
            @DestinationVariable String roomCode,
            @Payload DrawAction action,
            Principal principal
    ) {
        User user = resolveUser(principal);
        if (action != null) {
            scribbleService.handleDrawAction(roomCode, action, user != null ? user.getId() : null);
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

    @MessageMapping("/scribble/{roomCode}/restart")
    public void handleRestartGame(@DestinationVariable String roomCode, Principal principal) {
        User user = resolveUser(principal);
        scribbleService.restartGame(roomCode, user != null ? user.getId() : null);
    }

    @MessageMapping("/scribble/{roomCode}/end-game")
    public void handleEndGame(@DestinationVariable String roomCode, Principal principal) {
        User user = resolveUser(principal);
        scribbleService.endGame(roomCode, user != null ? user.getId() : null);
    }

    @MessageMapping("/scribble/{roomCode}/leave")
    public void handleLeave(@DestinationVariable String roomCode, Principal principal) {
        User user = resolveUser(principal);
        scribbleService.leaveRoom(roomCode, user != null ? user.getId() : null);
    }

    private User resolveUser(Principal principal) {
        if (principal instanceof org.springframework.security.authentication.UsernamePasswordAuthenticationToken auth) {
            if (auth.getPrincipal() instanceof com.mystic.workspace.security.UserPrincipal userPrincipal) {
                return userRepository.findById(userPrincipal.getId()).orElse(null);
            }
        }
        if (principal != null) {
            return userRepository.findByEmail(principal.getName()).orElse(null);
        }
        return null;
    }
}
