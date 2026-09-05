package com.mystic.workspace.service;

import com.mystic.workspace.dto.CreateMeetingRequest;
import com.mystic.workspace.dto.MeetingDto;
import com.mystic.workspace.entity.Meeting;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.MeetingParticipantRepository;
import com.mystic.workspace.repository.MeetingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MeetingServiceTest {

    @Mock
    private MeetingRepository meetingRepository;

    @Mock
    private MeetingParticipantRepository meetingParticipantRepository;

    @InjectMocks
    private MeetingService meetingService;

    private User user1;

    @BeforeEach
    void setUp() {
        user1 = User.builder().id(1L).name("User One").email("user1@nova.test").build();
    }

    @Test
    void testCreateInstantMeeting() {
        CreateMeetingRequest req = CreateMeetingRequest.builder()
                .title("Design Sync")
                .description("Reviewing UI components")
                .build();

        Meeting saved = Meeting.builder()
                .id(99L)
                .roomCode("nova-abc-xyz")
                .title("Design Sync")
                .host(user1)
                .status(Meeting.Status.ACTIVE)
                .build();

        when(meetingRepository.save(any(Meeting.class))).thenReturn(saved);
        when(meetingParticipantRepository.findByMeetingId(99L)).thenReturn(Collections.emptyList());

        MeetingDto result = meetingService.createInstantMeeting(user1, req);

        assertNotNull(result);
        assertEquals("Design Sync", result.getTitle());
        assertEquals("nova-abc-xyz", result.getRoomCode());
        assertEquals("ACTIVE", result.getStatus());
        verify(meetingRepository).save(any(Meeting.class));
        verify(meetingParticipantRepository).save(any());
    }
}
