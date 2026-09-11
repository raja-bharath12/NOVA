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

        action.setRoomCode(roomCode);
        action.setTimestamp(System.currentTimeMillis());

        if (principal != null) {
            action.setSenderName(principal.getName());
        }

        // Broadcast sync action to all listeners in room
        messagingTemplate.convertAndSend("/topic/music/" + roomCode.toLowerCase(), action);
    }

    @MessageMapping("/music/{roomCode}/reaction")
    public void handleReaction(
            @DestinationVariable String roomCode,
            @Payload MusicDtos.SyncAction reaction,
            Principal principal) {
        if (reaction == null) return;

        reaction.setType(MusicDtos.SyncAction.Type.REACTION);
        reaction.setRoomCode(roomCode);
        reaction.setTimestamp(System.currentTimeMillis());

        if (principal != null) {
            reaction.setSenderName(principal.getName());
        }

        messagingTemplate.convertAndSend("/topic/music/" + roomCode.toLowerCase() + "/reactions", reaction);
    }

    @MessageMapping("/music/{roomCode}/chat")
    public void handleChat(
            @DestinationVariable String roomCode,
            @Payload MusicDtos.SyncAction chatAction,
            Principal principal) {
        if (chatAction == null || chatAction.getChatContent() == null) return;

        if (principal != null) {
            userRepository.findByEmail(principal.getName()).ifPresent(user -> {
                MusicDtos.ChatMessageDto msg = musicService.addChatMessage(roomCode, chatAction.getChatContent(), user);
                messagingTemplate.convertAndSend("/topic/music/" + roomCode.toLowerCase() + "/chat", msg);
            });
        }
    }
}
