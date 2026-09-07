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
    private final AuthService authService;

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

    @Transactional
    public ConversationDto createOrGetDirectByTag(User currentUser, String userTag) {
        User recipient = resolveUser(userTag);

        if (recipient.getId().equals(currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot start a direct conversation with yourself");
        }

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
    }

    @Transactional
    public UserDto lookupUserByTag(User currentUser, String userTag) {
        User user = resolveUser(userTag);

        return UserDto.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .userTag(user.getUserTag())
                .status(presenceService.getUserStatus(user.getId()))
                .build();
    }

    public User resolveUser(String rawIdentifier) {
        if (rawIdentifier == null || rawIdentifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User ID, Chat Tag, or Email is required");
        }

        String cleaned = rawIdentifier.trim();
        // If full URL was pasted, extract the tag
        if (cleaned.contains("/chat/u/")) {
            cleaned = cleaned.substring(cleaned.lastIndexOf("/chat/u/") + 8);
        }
        cleaned = cleaned.replaceAll("^[#@]+", "").split("[/?#]")[0].trim();

        if (cleaned.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user identifier");
        }

        // 1. Direct match on userTag (case-insensitive)
        Optional<User> byTag = userRepository.findByUserTagIgnoreCase(cleaned);
        if (byTag.isPresent()) return byTag.get();

        // 2. Direct match on email (case-insensitive)
        Optional<User> byEmail = userRepository.findByEmail(cleaned.toLowerCase());
        if (byEmail.isPresent()) {
            User u = byEmail.get();
            if (u.getUserTag() == null || u.getUserTag().isBlank()) {
                u.setUserTag(authService.generateUniqueUserTag());
                u = userRepository.save(u);
            }
            return u;
        }

        // 3. Numeric user ID match
        try {
            Long userId = Long.parseLong(cleaned);
            Optional<User> byId = userRepository.findById(userId);
            if (byId.isPresent()) {
                User u = byId.get();
                if (u.getUserTag() == null || u.getUserTag().isBlank()) {
                    u.setUserTag(authService.generateUniqueUserTag());
                    u = userRepository.save(u);
                }
                return u;
            }
        } catch (NumberFormatException ignored) {}

        // 4. Fallback search across all users (handling fallback hash tags generated client-side)
        List<User> allUsers = userRepository.findAll();
        for (User u : allUsers) {
            String fallbackTag = computeDeterministicTag(u.getId(), u.getEmail());
            if (fallbackTag.equalsIgnoreCase(cleaned)) {
                u.setUserTag(fallbackTag);
                return userRepository.save(u);
            }
        }

        // 5. Name match fallback (if unique match)
        List<User> nameMatches = allUsers.stream()
                .filter(u -> u.getName() != null && u.getName().equalsIgnoreCase(cleaned))
                .toList();
        if (nameMatches.size() == 1) {
            User u = nameMatches.get(0);
            if (u.getUserTag() == null || u.getUserTag().isBlank()) {
                u.setUserTag(authService.generateUniqueUserTag());
                u = userRepository.save(u);
            }
            return u;
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No user found matching ID: " + rawIdentifier.trim());
    }

    private String computeDeterministicTag(Long id, String email) {
        if (id == null && (email == null || email.isBlank())) return "";
        String seed = (id != null ? id : 1) + "_" + (email != null ? email : "bharath") + "_nova_workspace";
        long hash = 5381;
        for (int i = 0; i < seed.length(); i++) {
            hash = ((hash << 5) + hash) + seed.charAt(i);
            hash = hash & 0xFFFFFFFFL;
        }
        long current = Math.abs(hash);
        String tagChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 10; i++) {
            int idx = (int) ((current + i * 13 + i * i * 7) % tagChars.length());
            sb.append(tagChars.charAt(idx));
            current = (current * 1664525L + 1013904223L) & 0x7FFFFFFFL;
        }
        return sb.toString();
    }

    public List<UserDto> searchUsers(User currentUser, String query) {
        String q = (query != null) ? query.trim().toLowerCase() : "";
        List<User> users = userRepository.findAll().stream()
                .filter(u -> !u.getId().equals(currentUser.getId()))
                .filter(u -> q.isEmpty() ||
                        (u.getName() != null && u.getName().toLowerCase().contains(q)) ||
                        (u.getEmail() != null && u.getEmail().toLowerCase().contains(q)) ||
                        (u.getUserTag() != null && u.getUserTag().toLowerCase().contains(q)))
                .collect(Collectors.toList());

        return users.stream().map(u -> UserDto.builder()
                .id(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .userTag(u.getUserTag())
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
                .userTag(m.getUser().getUserTag())
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
                    .sender(UserDto.builder()
                            .id(lm.getSender().getId())
                            .name(lm.getSender().getName())
                            .email(lm.getSender().getEmail())
                            .userTag(lm.getSender().getUserTag())
                            .build())
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
                .createdBy(entity.getCreatedBy() != null ? UserDto.builder()
                        .id(entity.getCreatedBy().getId())
                        .name(entity.getCreatedBy().getName())
                        .email(entity.getCreatedBy().getEmail())
                        .userTag(entity.getCreatedBy().getUserTag())
                        .build() : null)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .members(memberDtos)
                .lastMessage(lastMessageDto)
                .unreadCount(unreadCount)
                .userRole(userMember != null ? userMember.getRole().name() : null)
                .build();
    }
}
