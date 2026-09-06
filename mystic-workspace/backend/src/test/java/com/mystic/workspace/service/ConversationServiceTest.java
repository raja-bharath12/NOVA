package com.mystic.workspace.service;

import com.mystic.workspace.dto.ConversationDto;
import com.mystic.workspace.dto.CreateConversationRequest;
import com.mystic.workspace.entity.Conversation;
import com.mystic.workspace.entity.ConversationMember;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.ConversationMemberRepository;
import com.mystic.workspace.repository.ConversationRepository;
import com.mystic.workspace.repository.MessageRepository;
import com.mystic.workspace.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private ConversationMemberRepository conversationMemberRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private PresenceService presenceService;

    @InjectMocks
    private ConversationService conversationService;

    private User user1;
    private User user2;

    @BeforeEach
    void setUp() {
        user1 = User.builder().id(1L).name("User One").email("user1@nova.test").build();
        user2 = User.builder().id(2L).name("User Two").email("user2@nova.test").build();
    }

    @Test
    void testCreateDirectConversation() {
        CreateConversationRequest req = CreateConversationRequest.builder()
                .type("DIRECT")
                .recipientId(2L)
                .build();

        when(userRepository.findById(2L)).thenReturn(Optional.of(user2));
        when(conversationRepository.findDirectConversationBetween(1L, 2L)).thenReturn(Optional.empty());

        Conversation saved = Conversation.builder()
                .id(10L)
                .type(Conversation.Type.DIRECT)
                .createdBy(user1)
                .title("User Two")
                .build();

        when(conversationRepository.save(any(Conversation.class))).thenReturn(saved);
        when(conversationMemberRepository.findByConversationId(10L)).thenReturn(List.of(
                ConversationMember.builder().user(user1).role(ConversationMember.Role.MEMBER).build(),
                ConversationMember.builder().user(user2).role(ConversationMember.Role.MEMBER).build()
        ));

        ConversationDto result = conversationService.createConversation(user1, req);

        assertNotNull(result);
        assertEquals("DIRECT", result.getType());
        assertEquals("User Two", result.getTitle());
        verify(conversationRepository).save(any(Conversation.class));
        verify(conversationMemberRepository).saveAll(any());
    }

    @Test
    void testCreateGroupConversation() {
        CreateConversationRequest req = CreateConversationRequest.builder()
                .type("GROUP")
                .title("Core Project Team")
                .memberIds(List.of(2L))
                .build();

        Conversation saved = Conversation.builder()
                .id(20L)
                .type(Conversation.Type.GROUP)
                .title("Core Project Team")
                .createdBy(user1)
                .build();

        when(conversationRepository.save(any(Conversation.class))).thenReturn(saved);
        when(userRepository.findById(2L)).thenReturn(Optional.of(user2));
        when(conversationMemberRepository.findByConversationId(20L)).thenReturn(List.of(
                ConversationMember.builder().user(user1).role(ConversationMember.Role.ADMIN).build(),
                ConversationMember.builder().user(user2).role(ConversationMember.Role.MEMBER).build()
        ));

        ConversationDto result = conversationService.createConversation(user1, req);

        assertNotNull(result);
        assertEquals("GROUP", result.getType());
        assertEquals("Core Project Team", result.getTitle());
    }

    @Test
    void testCreateOrGetDirectByTag() {
        user2.setUserTag("MYST-TEST02");
        when(userRepository.findByUserTagIgnoreCase("MYST-TEST02")).thenReturn(Optional.of(user2));
        when(conversationRepository.findDirectConversationBetween(1L, 2L)).thenReturn(Optional.empty());

        Conversation saved = Conversation.builder()
                .id(30L)
                .type(Conversation.Type.DIRECT)
                .createdBy(user1)
                .title("User Two")
                .build();

        when(conversationRepository.save(any(Conversation.class))).thenReturn(saved);
        when(conversationMemberRepository.findByConversationId(30L)).thenReturn(List.of(
                ConversationMember.builder().user(user1).role(ConversationMember.Role.MEMBER).build(),
                ConversationMember.builder().user(user2).role(ConversationMember.Role.MEMBER).build()
        ));

        ConversationDto result = conversationService.createOrGetDirectByTag(user1, "myst-test02");

        assertNotNull(result);
        assertEquals("DIRECT", result.getType());
        assertEquals("User Two", result.getTitle());
        verify(conversationRepository).save(any(Conversation.class));
    }

    @Test
    void testLookupUserByTag() {
        user2.setUserTag("MYST-TEST02");
        when(userRepository.findByUserTagIgnoreCase("MYST-TEST02")).thenReturn(Optional.of(user2));
        when(presenceService.getUserStatus(2L)).thenReturn("ONLINE");

        var userDto = conversationService.lookupUserByTag(user1, "MYST-TEST02");

        assertNotNull(userDto);
        assertEquals("User Two", userDto.getName());
        assertEquals("MYST-TEST02", userDto.getUserTag());
        assertEquals("ONLINE", userDto.getStatus());
    }
}
