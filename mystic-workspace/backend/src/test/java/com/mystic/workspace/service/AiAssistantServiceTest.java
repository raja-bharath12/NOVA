package com.mystic.workspace.service;

import com.mystic.workspace.dto.*;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiAssistantServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private MeetingRepository meetingRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private FileMetadataRepository fileMetadataRepository;

    @Mock
    private ConversationMemberRepository conversationMemberRepository;

    @InjectMocks
    private AiAssistantService aiAssistantService;

    private User testUser;
    private Task sampleTask;
    private Meeting sampleMeeting;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .name("Raja Nova")
                .email("raja@nova.space")
                .password("encoded_pwd")
                .build();

        sampleTask = Task.builder()
                .id(10L)
                .title("Complete Stage 4 Whiteboard")
                .priority(Task.Priority.HIGH)
                .deadline(LocalDate.now())
                .completed(false)
                .user(testUser)
                .build();

        sampleMeeting = Meeting.builder()
                .id(20L)
                .title("Sprint Review")
                .roomCode("NOV-REV-1")
                .host(testUser)
                .build();
    }

    @Test
    void testProcessPromptTaskBreakdown() {
        when(taskRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(sampleTask));
        when(eventRepository.findByUserIdOrderByStartTimeAsc(1L)).thenReturn(List.of());
        when(meetingRepository.findAllForUser(1L)).thenReturn(List.of(sampleMeeting));

        AiChatRequest request = AiChatRequest.builder()
                .prompt("Please create tasks for deploying quantum cloud infrastructure")
                .build();

        AiChatResponse response = aiAssistantService.processPrompt(testUser, request);

        assertNotNull(response);
        assertNotNull(response.getResponse());
        assertNotNull(response.getSuggestedTasks());
        assertFalse(response.getSuggestedTasks().isEmpty());
    }

    @Test
    void testProcessPromptSchedulePlanning() {
        when(taskRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(sampleTask));
        when(eventRepository.findByUserIdOrderByStartTimeAsc(1L)).thenReturn(List.of());
        when(meetingRepository.findAllForUser(1L)).thenReturn(List.of(sampleMeeting));

        AiChatRequest request = AiChatRequest.builder()
                .prompt("What is my schedule and agenda for today?")
                .build();

        AiChatResponse response = aiAssistantService.processPrompt(testUser, request);

        assertNotNull(response);
        assertNotNull(response.getResponse());
        assertTrue(response.getResponse().contains("Schedule") || response.getResponse().contains("Agenda") || response.getResponse().length() > 20);
    }

    @Test
    void testCreateSuggestedTasks() {
        when(taskRepository.saveAll(anyList())).thenAnswer(invocation -> {
            List<Task> list = invocation.getArgument(0);
            long id = 100L;
            for (Task t : list) {
                t.setId(id++);
            }
            return list;
        });

        CreateSuggestedTasksRequest req = CreateSuggestedTasksRequest.builder()
                .tasks(List.of(
                        AiTaskSuggestionDto.builder()
                                .title("Setup Redis Cache")
                                .description("Configure Redis for session store")
                                .priority("HIGH")
                                .category("Architecture")
                                .build(),
                        AiTaskSuggestionDto.builder()
                                .title("Write End-to-End Tests")
                                .description("Test calling flow")
                                .priority("MEDIUM")
                                .category("QA")
                                .build()
                ))
                .build();

        List<TaskDto> created = aiAssistantService.createSuggestedTasks(testUser, req);

        assertNotNull(created);
        assertEquals(2, created.size());
        verify(taskRepository, times(1)).saveAll(anyList());
    }

    @Test
    void testGetAnalytics() {
        when(taskRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(
                sampleTask,
                Task.builder().id(11L).title("Done Task").completed(true).priority(Task.Priority.MEDIUM).user(testUser).build()
        ));
        when(eventRepository.findByUserIdOrderByStartTimeAsc(1L)).thenReturn(List.of());
        when(meetingRepository.findAllForUser(1L)).thenReturn(List.of(sampleMeeting));
        when(fileMetadataRepository.findByOwnerIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        AiProductivityAnalyticsDto analytics = aiAssistantService.getAnalytics(testUser);

        assertNotNull(analytics);
        assertEquals(2, analytics.getTotalTasks());
        assertEquals(1, analytics.getCompletedTasks());
        assertEquals(50.0, analytics.getCompletionRate());
        assertNotNull(analytics.getProductivityInsight());
    }
}
