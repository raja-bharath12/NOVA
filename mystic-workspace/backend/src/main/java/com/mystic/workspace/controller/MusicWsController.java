package com.mystic.workspace.controller;

import com.mystic.workspace.dto.MusicDtos;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.service.MusicService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class MusicWsController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MusicService musicService;
    private final UserRepository userRepository;

    @MessageMapping("/music/{roomCode}/action")
    public void handleSyncAction(
            @DestinationVariable String roomCode,
            @Payload MusicDtos.SyncAction action,
            Principal principal) {
        if (action == null) return;

        String cleanCode = roomCode.trim().toLowerCase();
        action.setRoomCode(cleanCode);
        action.setTimestamp(System.currentTimeMillis());

        User user = null;
        if (principal != null) {
            user = userRepository.findByEmail(principal.getName()).orElse(null);
            if (user != null) {
                action.setSenderId(user.getId());
                action.setSenderName(user.getName());
            } else {
                action.setSenderName(principal.getName());
            }
        }

        // Persist real-time playback state in DB for late joiners
        try {
            if (action.getType() == MusicDtos.SyncAction.Type.PLAY) {
                musicService.updatePlaybackState(cleanCode, action.getPosition(), true, 1.0, user);
            } else if (action.getType() == MusicDtos.SyncAction.Type.PAUSE) {
                musicService.updatePlaybackState(cleanCode, action.getPosition(), false, 1.0, user);
            } else if (action.getType() == MusicDtos.SyncAction.Type.SEEK) {
                musicService.updatePlaybackState(cleanCode, action.getPosition(), null, 1.0, user);
            }
        } catch (Exception e) {
            log.warn("Could not update music room DB state for {}: {}", cleanCode, e.getMessage());
        }

        // Broadcast sync action to all listeners in room
        messagingTemplate.convertAndSend("/topic/music/" + cleanCode, action);
        log.debug("Music action broadcast to /topic/music/{}: type={}, pos={}, sender={}", cleanCode, action.getType(), action.getPosition(), action.getSenderName());
    }

    @MessageMapping("/music/{roomCode}/reaction")
    public void handleReaction(
            @DestinationVariable String roomCode,
            @Payload MusicDtos.SyncAction reaction,
            Principal principal) {
        if (reaction == null) return;

        String cleanCode = roomCode.trim().toLowerCase();
        reaction.setType(MusicDtos.SyncAction.Type.REACTION);
        reaction.setRoomCode(cleanCode);
        reaction.setTimestamp(System.currentTimeMillis());

        if (principal != null) {
            userRepository.findByEmail(principal.getName()).ifPresent(u -> {
                reaction.setSenderId(u.getId());
                reaction.setSenderName(u.getName());
            });
        }

        messagingTemplate.convertAndSend("/topic/music/" + cleanCode + "/reactions", reaction);
    }

    @MessageMapping("/music/{roomCode}/chat")
    public void handleChat(
            @DestinationVariable String roomCode,
            @Payload MusicDtos.SyncAction chatAction,
            Principal principal) {
        if (chatAction == null || chatAction.getChatContent() == null) return;

        String cleanCode = roomCode.trim().toLowerCase();
        if (principal != null) {
            userRepository.findByEmail(principal.getName()).ifPresent(user -> {
                MusicDtos.ChatMessageDto msg = musicService.addChatMessage(cleanCode, chatAction.getChatContent(), user);
                messagingTemplate.convertAndSend("/topic/music/" + cleanCode + "/chat", msg);
            });
        }
    }
}

