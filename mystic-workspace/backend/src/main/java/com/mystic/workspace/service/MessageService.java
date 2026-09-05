package com.mystic.workspace.service;

import com.mystic.workspace.dto.*;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
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
public class MessageService {

    private final MessageRepository messageRepository;
    private final MessageReadRepository messageReadRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final FileService fileService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public List<MessageDto> getMessages(User currentUser, Long conversationId, String query) {
        if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to view messages in this conversation");
        }

        List<Message> messages;
        if (query != null && !query.isBlank()) {
            messages = messageRepository.searchMessages(conversationId, query.trim());
        } else {
            messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        }

        return messages.stream()
                .map(m -> toDto(m, currentUser))
                .collect(Collectors.toList());
    }

    @Transactional
    public MessageDto sendMessage(User currentUser, Long conversationId, SendMessageRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to send messages to this conversation");
        }

        boolean hasContent = request.getContent() != null && !request.getContent().isBlank();
        boolean hasAttachments = request.getAttachmentFileIds() != null && !request.getAttachmentFileIds().isEmpty();

        if (!hasContent && !hasAttachments) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message must have text content or attachments");
        }

        Message replyTo = null;
        if (request.getReplyToId() != null) {
            replyTo = messageRepository.findById(request.getReplyToId()).orElse(null);
        }

        Message message = Message.builder()
                .conversation(conversation)
                .sender(currentUser)
                .content(request.getContent())
                .replyTo(replyTo)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        Message savedMessage = messageRepository.save(message);

        // Attach files if provided
        if (hasAttachments) {
            List<FileMetadata> files = fileMetadataRepository.findAllById(request.getAttachmentFileIds());
            for (FileMetadata f : files) {
                f.setConversation(conversation);
                f.setMessage(savedMessage);
            }
            fileMetadataRepository.saveAll(files);
            savedMessage.setAttachments(files);
        }

        // Update conversation timestamp
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);

        // Update sender's last read timestamp
        conversationMemberRepository.findByConversationIdAndUserId(conversationId, currentUser.getId())
                .ifPresent(m -> {
                    m.setLastReadAt(Instant.now());
                    conversationMemberRepository.save(m);
                });

        MessageDto dto = toDto(savedMessage, currentUser);

        // Broadcast to conversation topic
        broadcastMessage(conversationId, dto);

        // Broadcast notification to other members
        List<ConversationMember> members = conversationMemberRepository.findByConversationId(conversationId);
        for (ConversationMember member : members) {
            if (!member.getUser().getId().equals(currentUser.getId())) {
                notifyMemberMessage(member.getUser().getEmail(), dto);
            }
        }

        return dto;
    }

    @Transactional
    public MessageDto editMessage(User currentUser, Long messageId, EditMessageRequest request) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        if (!message.getSender().getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can edit this message");
        }

        if (message.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot edit a deleted message");
        }

        message.setContent(request.getContent());
        message.setEdited(true);
        message.setUpdatedAt(Instant.now());
        Message saved = messageRepository.save(message);

        MessageDto dto = toDto(saved, currentUser);
        broadcastMessage(saved.getConversation().getId(), dto);

        return dto;
    }

    @Transactional
    public void deleteMessage(User currentUser, Long messageId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        ConversationMember member = conversationMemberRepository
                .findByConversationIdAndUserId(message.getConversation().getId(), currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this conversation"));

        if (!message.getSender().getId().equals(currentUser.getId()) && member.getRole() != ConversationMember.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to delete this message");
        }

        message.setDeleted(true);
        message.setContent("This message was deleted");
        message.setUpdatedAt(Instant.now());
        Message saved = messageRepository.save(message);

        MessageDto dto = toDto(saved, currentUser);
        broadcastMessage(saved.getConversation().getId(), dto);
    }

    @Transactional
    public void markMessageAsRead(User currentUser, Long conversationId, Long messageId) {
        if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this conversation");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Message not found"));

        if (!messageReadRepository.existsByMessageIdAndUserId(messageId, currentUser.getId())) {
            MessageRead read = MessageRead.builder()
                    .message(message)
                    .user(currentUser)
                    .readAt(Instant.now())
                    .build();
            messageReadRepository.save(read);
        }

        // Update member's lastReadAt
        conversationMemberRepository.findByConversationIdAndUserId(conversationId, currentUser.getId())
                .ifPresent(m -> {
                    m.setLastReadAt(Instant.now());
                    conversationMemberRepository.save(m);
                });

        // Broadcast read receipt
        ReadReceiptDto receipt = ReadReceiptDto.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .userId(currentUser.getId())
                .readAt(Instant.now())
                .build();

        try {
            messagingTemplate.convertAndSend("/topic/conversations." + conversationId + ".reads", receipt);
        } catch (Exception e) {
            log.error("Failed to broadcast read receipt: {}", e.getMessage());
        }
    }

    private void broadcastMessage(Long conversationId, MessageDto dto) {
        try {
            messagingTemplate.convertAndSend("/topic/conversations." + conversationId, dto);
        } catch (Exception e) {
            log.error("Failed to broadcast message to conversation {}: {}", conversationId, e.getMessage());
        }
    }

    private void notifyMemberMessage(String userEmail, MessageDto dto) {
        try {
            messagingTemplate.convertAndSendToUser(userEmail, "/queue/notifications", dto);
        } catch (Exception e) {
            log.error("Failed to send notification to user {}: {}", userEmail, e.getMessage());
        }
    }

    public MessageDto toDto(Message entity, User forUser) {
        if (entity == null) return null;

        User sender = entity.getSender();
        UserDto senderDto = UserDto.builder()
                .id(sender.getId())
                .name(sender.getName())
                .email(sender.getEmail())
                .build();

        List<FileDto> attachmentDtos = entity.getAttachments().stream()
                .map(fileService::toDto)
                .collect(Collectors.toList());

        List<Long> readUserIds = messageReadRepository.findByMessageId(entity.getId()).stream()
                .map(r -> r.getUser().getId())
                .collect(Collectors.toList());

        boolean isRead = readUserIds.stream().anyMatch(id -> !id.equals(entity.getSender().getId()));

        Long replyToId = null;
        String replyToContent = null;
        String replyToSenderName = null;
        if (entity.getReplyTo() != null) {
            replyToId = entity.getReplyTo().getId();
            replyToContent = entity.getReplyTo().isDeleted() ? "This message was deleted" : entity.getReplyTo().getContent();
            replyToSenderName = entity.getReplyTo().getSender().getName();
        }

        return MessageDto.builder()
                .id(entity.getId())
                .conversationId(entity.getConversation().getId())
                .sender(senderDto)
                .content(entity.isDeleted() ? "This message was deleted" : entity.getContent())
                .replyToId(replyToId)
                .replyToContent(replyToContent)
                .replyToSenderName(replyToSenderName)
                .isEdited(entity.isEdited())
                .isDeleted(entity.isDeleted())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .attachments(attachmentDtos)
                .readByUserIds(readUserIds)
                .isDelivered(true)
                .isRead(isRead)
                .build();
    }
}
