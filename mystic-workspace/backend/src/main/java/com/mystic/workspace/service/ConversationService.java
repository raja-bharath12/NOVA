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
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final PresenceService presenceService;

    @Transactional(readOnly = true)
    public List<ConversationDto> getUserConversations(User currentUser) {
        List<Conversation> conversations = conversationRepository.findAllByUserId(currentUser.getId());
        return conversations.stream()
                .map(c -> toDto(c, currentUser))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ConversationDto getConversation(User currentUser, Long id) {
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (!conversationMemberRepository.existsByConversationIdAndUserId(id, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to access this conversation");
        }

        return toDto(conversation, currentUser);
    }

    @Transactional
    public ConversationDto createConversation(User currentUser, CreateConversationRequest request) {
        if ("DIRECT".equalsIgnoreCase(request.getType())) {
            if (request.getRecipientId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recipient ID is required for direct conversations");
            }
            if (request.getRecipientId().equals(currentUser.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot create a direct conversation with yourself");
            }

            User recipient = userRepository.findById(request.getRecipientId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Recipient not found"));

            // Check if conversation already exists
            Optional<Conversation> existing = conversationRepository.findDirectConversationBetween(currentUser.getId(), recipient.getId());
            if (existing.isPresent()) {
                return toDto(existing.get(), currentUser);
            }

            Conversation conversation = Conversation.builder()
                    .type(Conversation.Type.DIRECT)
                    .title(recipient.getName())
                    .createdBy(currentUser)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();

            Conversation saved = conversationRepository.save(conversation);

            ConversationMember m1 = ConversationMember.builder()
                    .conversation(saved)
                    .user(currentUser)
                    .role(ConversationMember.Role.MEMBER)
                    .build();

            ConversationMember m2 = ConversationMember.builder()
                    .conversation(saved)
                    .user(recipient)
                    .role(ConversationMember.Role.MEMBER)
                    .build();

            conversationMemberRepository.saveAll(List.of(m1, m2));

            // Notify recipient over private queue
            notifyUserNewConversation(recipient.getEmail(), toDto(saved, recipient));

            return toDto(saved, currentUser);
        } else {
            // GROUP conversation
            String title = (request.getTitle() != null && !request.getTitle().isBlank())
                    ? request.getTitle().trim()
                    : "New Group";

            Conversation conversation = Conversation.builder()
                    .type(Conversation.Type.GROUP)
                    .title(title)
                    .createdBy(currentUser)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();

            Conversation saved = conversationRepository.save(conversation);

            List<ConversationMember> members = new ArrayList<>();
            members.add(ConversationMember.builder()
                    .conversation(saved)
                    .user(currentUser)
                    .role(ConversationMember.Role.ADMIN)
                    .build());

            if (request.getMemberIds() != null) {
                for (Long memberId : request.getMemberIds()) {
                    if (!memberId.equals(currentUser.getId())) {
                        userRepository.findById(memberId).ifPresent(user -> {
                            members.add(ConversationMember.builder()
                                    .conversation(saved)
                                    .user(user)
                                    .role(ConversationMember.Role.MEMBER)
                                    .build());
                        });
                    }
                }
            }

            conversationMemberRepository.saveAll(members);

            // Notify all members
            for (ConversationMember m : members) {
                if (!m.getUser().getId().equals(currentUser.getId())) {
                    notifyUserNewConversation(m.getUser().getEmail(), toDto(saved, m.getUser()));
                }
            }

            return toDto(saved, currentUser);
        }
    }

    @Transactional
    public ConversationDto addMembers(User currentUser, Long conversationId, AddMemberRequest request) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized to modify this conversation");
        }

        List<ConversationMember> toAdd = new ArrayList<>();
        for (Long userId : request.getUserIds()) {
            if (!conversationMemberRepository.existsByConversationIdAndUserId(conversationId, userId)) {
                userRepository.findById(userId).ifPresent(user -> {
                    toAdd.add(ConversationMember.builder()
                            .conversation(conversation)
                            .user(user)
                            .role(ConversationMember.Role.MEMBER)
                            .build());
                });
            }
        }

        if (!toAdd.isEmpty()) {
            conversationMemberRepository.saveAll(toAdd);
            conversation.setUpdatedAt(Instant.now());
            conversationRepository.save(conversation);

            for (ConversationMember m : toAdd) {
                notifyUserNewConversation(m.getUser().getEmail(), toDto(conversation, m.getUser()));
            }
        }

        return toDto(conversation, currentUser);
    }

    @Transactional
    public void removeMember(User currentUser, Long conversationId, Long targetUserId) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));

        ConversationMember currentMember = conversationMemberRepository
                .findByConversationIdAndUserId(conversationId, currentUser.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Not a member of this conversation"));

        // Only admins can remove others; members can remove themselves (leave)
        if (!currentUser.getId().equals(targetUserId) && currentMember.getRole() != ConversationMember.Role.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only group admins can remove other members");
        }

        conversationMemberRepository.deleteByConversationIdAndUserId(conversationId, targetUserId);
    }

    public List<UserDto> searchUsers(User currentUser, String query) {
        List<User> users = userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .filter(u -> query == null || query.isBlank() ||
                        u.getName().toLowerCase().contains(query.toLowerCase()) ||
                        u.getEmail().toLowerCase().contains(query.toLowerCase()))
                .collect(Collectors.toList());

        return users.stream().map(u -> UserDto.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .status(presenceService.getUserStatus(u.getId()))
                .build()).collect(Collectors.toList());
    }

    private void notifyUserNewConversation(String userEmail, ConversationDto dto) {
        try {
            messagingTemplate.convertAndSendToUser(userEmail, "/queue/conversations", dto);
        } catch (Exception e) {
            log.error("Failed to notify user {} about new conversation: {}", userEmail, e.getMessage());
        }
    }

    public ConversationDto toDto(Conversation entity, User forUser) {
        if (entity == null) return null;

        List<ConversationMember> members = conversationMemberRepository.findByConversationId(entity.getId());
        List<UserDto> memberDtos = members.stream().map(m -> UserDto.builder()
                .id(m.getUser().getId())
                .name(m.getUser().getName())
                .email(m.getUser().getEmail())
                .status(presenceService.getUserStatus(m.getUser().getId()))
                .build()).collect(Collectors.toList());

        String displayTitle = entity.getTitle();
        if (entity.getType() == Conversation.Type.DIRECT) {
            // For 1:1, the title shown to forUser is the other user's name
            displayTitle = memberDtos.stream()
                    .filter(m -> !m.getId().equals(forUser.getId()))
                    .findFirst()
                    .map(UserDto::getName)
                    .orElse(entity.getTitle());
        }

        ConversationMember userMember = members.stream()
                .filter(m -> m.getUser().getId().equals(forUser.getId()))
                .findFirst()
                .orElse(null);

        long unreadCount = 0;
        if (userMember != null) {
            unreadCount = messageRepository.countUnreadMessages(entity.getId(), userMember.getLastReadAt(), forUser.getId());
        }

        MessageDto lastMessageDto = null;
        Optional<Message> lastMessage = messageRepository.findTopByConversationIdOrderByCreatedAtDesc(entity.getId());
        if (lastMessage.isPresent()) {
            Message lm = lastMessage.get();
            lastMessageDto = MessageDto.builder()
                    .id(lm.getId())
                    .conversationId(entity.getId())
                    .sender(UserDto.builder().id(lm.getSender().getId()).name(lm.getSender().getName()).email(lm.getSender().getEmail()).build())
                    .content(lm.isDeleted() ? "This message was deleted" : lm.getContent())
                    .isEdited(lm.isEdited())
                    .isDeleted(lm.isDeleted())
                    .createdAt(lm.getCreatedAt())
                    .build();
        }

        return ConversationDto.builder()
                .id(entity.getId())
                .type(entity.getType().name())
                .title(displayTitle)
                .createdBy(entity.getCreatedBy() != null ? UserDto.builder().id(entity.getCreatedBy().getId()).name(entity.getCreatedBy().getName()).email(entity.getCreatedBy().getEmail()).build() : null)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .members(memberDtos)
                .lastMessage(lastMessageDto)
                .unreadCount(unreadCount)
                .userRole(userMember != null ? userMember.getRole().name() : null)
                .build();
    }
}
