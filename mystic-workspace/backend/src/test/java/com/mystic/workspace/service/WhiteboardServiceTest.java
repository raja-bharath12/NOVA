package com.mystic.workspace.service;

import com.mystic.workspace.dto.SaveWhiteboardRequest;
import com.mystic.workspace.dto.WhiteboardDto;
import com.mystic.workspace.entity.Meeting;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.Whiteboard;
import com.mystic.workspace.repository.MeetingRepository;
import com.mystic.workspace.repository.WhiteboardRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WhiteboardServiceTest {

    @Mock
    private WhiteboardRepository whiteboardRepository;

    @Mock
    private MeetingRepository meetingRepository;

    @InjectMocks
    private WhiteboardService whiteboardService;

    private User user1;

    @BeforeEach
    void setUp() {
        user1 = User.builder().id(1L).name("User One").email("user1@nova.test").build();
    }

    @Test
    void testSaveWhiteboard() {
        SaveWhiteboardRequest req = SaveWhiteboardRequest.builder()
                .title("Architecture Blueprint")
                .dataJson("{\"elements\":[]}")
                .build();

        Whiteboard saved = Whiteboard.builder()
                .id(10L)
                .title("Architecture Blueprint")
                .dataJson("{\"elements\":[]}")
                .owner(user1)
                .build();

        when(whiteboardRepository.save(any(Whiteboard.class))).thenReturn(saved);

        WhiteboardDto result = whiteboardService.saveWhiteboard(user1, req);

        assertNotNull(result);
        assertEquals("Architecture Blueprint", result.getTitle());
        assertEquals("{\"elements\":[]}", result.getDataJson());
        verify(whiteboardRepository).save(any(Whiteboard.class));
    }

    @Test
    void testGetOrCreateMeetingWhiteboard() {
        when(whiteboardRepository.findByMeetingRoomCode("nova-test-room")).thenReturn(Optional.empty());

        Meeting meeting = Meeting.builder().id(5L).roomCode("nova-test-room").title("Team Sync").build();
        when(meetingRepository.findByRoomCode("nova-test-room")).thenReturn(Optional.of(meeting));

        Whiteboard saved = Whiteboard.builder()
                .id(25L)
                .title("Team Sync - Whiteboard")
                .dataJson("[]")
                .owner(user1)
                .meeting(meeting)
                .build();

        when(whiteboardRepository.save(any(Whiteboard.class))).thenReturn(saved);

        WhiteboardDto result = whiteboardService.getOrCreateMeetingWhiteboard(user1, "nova-test-room");

        assertNotNull(result);
        assertEquals("Team Sync - Whiteboard", result.getTitle());
        verify(whiteboardRepository).save(any(Whiteboard.class));
    }
}
