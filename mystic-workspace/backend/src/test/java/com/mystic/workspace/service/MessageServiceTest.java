package com.mystic.workspace.service;

import com.mystic.workspace.dto.EditMessageRequest;
import com.mystic.workspace.dto.MessageDto;
import com.mystic.workspace.dto.SendMessageRequest;
import com.mystic.workspace.entity.Conversation;
import com.mystic.workspace.entity.ConversationMember;
import com.mystic.workspace.entity.Message;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MessageServiceTest {

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private MessageReadRepository messageReadRepository;

    @Mock
    private ConversationRepository conversationRepository;

    @Mock
    private ConversationMemberRepository conversationMemberRepository;

    @Mock
    private FileMetadataRepository fileMetadataRepository;

    @Mock
    private FileService fileService;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private MessageService messageService;

    private User user1;
    private User user2;
    private Conversation conversation;

    @BeforeEach
    void setUp() {
        user1 = User.builder().id(1L).name("User One").email("user1@nova.test").build();
        user2 = User.builder().id(2L).name("User Two").email("user2@nova.test").build();
        conversation = Conversation.builder().id(100L).type(Conversation.Type.DIRECT).build();
    }

    @Test
    void testSendMessage() {
        SendMessageRequest request = SendMessageRequest.builder()
                .content("Hello from NOVA workspace")
                .build();

        when(conversationRepository.findById(100L)).thenReturn(Optional.of(conversation));
        when(conversationMemberRepository.existsByConversationIdAndUserId(100L, 1L)).thenReturn(true);

        Message saved = Message.builder()
                .id(500L)
                .conversation(conversation)
                .sender(user1)
                .content("Hello from NOVA workspace")
                .attachments(Collections.emptyList())
                .build();

        when(messageRepository.save(any(Message.class))).thenReturn(saved);
        when(conversationMemberRepository.findByConversationId(100L)).thenReturn(List.of(
                ConversationMember.builder().user(user1).build(),
                ConversationMember.builder().user(user2).build()
        ));

        MessageDto result = messageService.sendMessage(user1, 100L, request);

        assertNotNull(result);
        assertEquals("Hello from NOVA workspace", result.getContent());
        assertEquals(1L, result.getSender().getId());
        verify(messageRepository).save(any(Message.class));
    }

    @Test
    void testEditMessage() {
        Message existing = Message.builder()
                .id(500L)
                .conversation(conversation)
                .sender(user1)
                .content("Original text")
                .attachments(Collections.emptyList())
                .build();

        when(messageRepository.findById(500L)).thenReturn(Optional.of(existing));
        when(messageRepository.save(any(Message.class))).thenReturn(existing);

        EditMessageRequest editReq = EditMessageRequest.builder()
                .content("Updated text")
                .build();

        MessageDto result = messageService.editMessage(user1, 500L, editReq);

        assertNotNull(result);
        assertTrue(existing.isEdited());
        assertEquals("Updated text", existing.getContent());
    }

    @Test
    void testDeleteMessage() {
        Message existing = Message.builder()
                .id(500L)
                .conversation(conversation)
                .sender(user1)
                .content("To be deleted")
                .attachments(Collections.emptyList())
                .build();

        when(messageRepository.findById(500L)).thenReturn(Optional.of(existing));
        when(conversationMemberRepository.findByConversationIdAndUserId(100L, 1L)).thenReturn(
                Optional.of(ConversationMember.builder().user(user1).role(ConversationMember.Role.MEMBER).build())
        );
        when(messageRepository.save(any(Message.class))).thenReturn(existing);

        messageService.deleteMessage(user1, 500L);

        assertTrue(existing.isDeleted());
        assertEquals("This message was deleted", existing.getContent());
    }
}
