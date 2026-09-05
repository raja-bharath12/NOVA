package com.mystic.workspace.service;

import com.mystic.workspace.dto.GlobalSearchResultDto;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private EventRepository eventRepository;

    @Mock
    private MessageRepository messageRepository;

    @Mock
    private FileMetadataRepository fileMetadataRepository;

    @Mock
    private MeetingRepository meetingRepository;

    @Mock
    private WhiteboardRepository whiteboardRepository;

    @InjectMocks
    private SearchService searchService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .name("Raja Nova")
                .email("raja@nova.space")
                .password("encoded_pwd")
                .build();
    }

    @Test
    void testSearchWorkspaceAcrossAllCategories() {
        Task task = Task.builder()
                .id(1L)
                .title("Design Quantum Canvas")
                .description("Whiteboard engine architecture")
                .user(testUser)
                .priority(Task.Priority.HIGH)
                .completed(false)
                .build();

        Meeting meeting = Meeting.builder()
                .id(2L)
                .title("Quantum Architecture Sync")
                .roomCode("NOV-QNT-1")
                .host(testUser)
                .status(Meeting.Status.WAITING)
                .build();

        Whiteboard wb = Whiteboard.builder()
                .id(3L)
                .title("Quantum Canvas Sketch")
                .owner(testUser)
                .build();

        when(taskRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(task));
        when(eventRepository.findByUserIdOrderByStartTimeAsc(1L)).thenReturn(List.of());
        when(messageRepository.searchAllMessagesForUser(1L, "quantum")).thenReturn(List.of());
        when(fileMetadataRepository.searchByFilename(1L, "quantum")).thenReturn(List.of());
        when(meetingRepository.findAllForUser(1L)).thenReturn(List.of(meeting));
        when(whiteboardRepository.searchByTitle(1L, "quantum")).thenReturn(List.of(wb));

        List<GlobalSearchResultDto> results = searchService.searchWorkspace(testUser, "quantum");

        assertNotNull(results);
        assertEquals(3, results.size());
        assertTrue(results.stream().anyMatch(r -> "TASK".equals(r.getType())));
        assertTrue(results.stream().anyMatch(r -> "MEETING".equals(r.getType())));
        assertTrue(results.stream().anyMatch(r -> "WHITEBOARD".equals(r.getType())));
    }

    @Test
    void testSearchWorkspaceEmptyQuery() {
        List<GlobalSearchResultDto> results = searchService.searchWorkspace(testUser, "");
        assertNotNull(results);
        assertTrue(results.isEmpty());
    }
}
