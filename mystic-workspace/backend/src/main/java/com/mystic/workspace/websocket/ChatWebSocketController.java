package com.mystic.workspace.websocket;

import com.mystic.workspace.dto.ReadReceiptDto;
import com.mystic.workspace.dto.SendMessageRequest;
import com.mystic.workspace.dto.TypingNotification;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.MessageService;
import com.mystic.workspace.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final MessageService messageService;
    private final PresenceService presenceService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload TypingNotification typingNotification, Principal principal) {
        if (principal == null || typingNotification.getConversationId() == null) return;
        User user = extractUser(principal);
        if (user == null) return;

        typingNotification.setUserId(user.getId());
        typingNotification.setUserName(user.getName());

        messagingTemplate.convertAndSend(
                "/topic/conversations." + typingNotification.getConversationId() + ".typing",
                typingNotification
        );
    }

    @MessageMapping("/chat.sendMessage/{conversationId}")
    public void handleSendMessage(
            @DestinationVariable Long conversationId,
            @Payload SendMessageRequest request,
            Principal principal
    ) {
        User user = extractUser(principal);
        if (user == null) return;

        messageService.sendMessage(user, conversationId, request);
    }

    @MessageMapping("/chat.readReceipt")
    public void handleReadReceipt(@Payload ReadReceiptDto receiptDto, Principal principal) {
        User user = extractUser(principal);
        if (user == null || receiptDto.getConversationId() == null || receiptDto.getMessageId() == null) return;

        messageService.markMessageAsRead(user, receiptDto.getConversationId(), receiptDto.getMessageId());
    }

    @MessageMapping("/presence.update")
    public void handlePresenceUpdate(@Payload String status, Principal principal) {
        User user = extractUser(principal);
        if (user == null) return;

        presenceService.updateUserStatus(user, status);
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
