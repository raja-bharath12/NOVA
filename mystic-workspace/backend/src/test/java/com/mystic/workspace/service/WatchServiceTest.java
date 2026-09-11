package com.mystic.workspace.service;

import com.mystic.workspace.dto.WatchChatMessageDto;
import com.mystic.workspace.dto.WatchRoomDto;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import com.mystic.workspace.service.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WatchServiceTest {

    @Mock
    private WatchMediaRepository mediaRepository;
    @Mock
    private WatchRoomRepository roomRepository;
    @Mock
    private WatchRoomMemberRepository memberRepository;
    @Mock
    private WatchRoomMessageRepository messageRepository;
    @Mock
    private StorageService storageService;

    @InjectMocks
    private WatchService watchService;

    private User hostUser;
    private User participantUser;
    private WatchMedia media;
    private WatchRoom room;

    @BeforeEach
    void setUp() {
        hostUser = User.builder().id(1L).email("host@test.com").name("Host User").build();
        participantUser = User.builder().id(2L).email("part@test.com").name("Participant User").build();

        media = WatchMedia.builder()
                .id(10L)
                .owner(hostUser)
                .title("Sample Movie")
                .originalFilename("sample.mp4")
                .storageKey("key-123.mp4")
                .mimeType("video/mp4")
                .fileSize(10485760L)
                .status(WatchMedia.Status.READY)
                .build();

        room = WatchRoom.builder()
                .id(100L)
                .roomCode("nova-watch-7xk92")
                .title("Sample Movie Watch Party")
                .media(media)
                .host(hostUser)
                .status(WatchRoom.Status.ACTIVE)
                .currentPosition(100.0)
                .isPlaying(true)
                .playbackRate(1.0)
                .lastSyncedAt(Instant.now().minusSeconds(10))
                .members(new ArrayList<>())
                .build();
    }

    @Test
    void createRoom_shouldGenerateRoomCodeAndRegisterHost() {
        when(mediaRepository.findById(10L)).thenReturn(Optional.of(media));
        when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        when(roomRepository.save(any(WatchRoom.class))).thenAnswer(inv -> {
            WatchRoom r = inv.getArgument(0);
            r.setId(100L);
            return r;
        });

        WatchRoomDto dto = watchService.createRoom(hostUser, 10L, "Movie Night");

        assertThat(dto).isNotNull();
        assertThat(dto.getRoomCode()).startsWith("nova-watch-");
        assertThat(dto.getHostId()).isEqualTo(1L);
        assertThat(dto.getTitle()).isEqualTo("Movie Night");
        verify(memberRepository).save(any(WatchRoomMember.class));
    }

    @Test
    void getRoomByCode_shouldCalculateAuthoritativePositionWhenPlaying() {
        when(roomRepository.findByRoomCode("nova-watch-7xk92")).thenReturn(Optional.of(room));
        when(memberRepository.findByRoomAndLeftAtIsNull(room)).thenReturn(List.of(
                WatchRoomMember.builder().user(hostUser).role(WatchRoomMember.Role.HOST).build()
        ));

        WatchRoomDto dto = watchService.getRoomByCode("nova-watch-7xk92");

        assertThat(dto.getCurrentPosition()).isGreaterThanOrEqualTo(109.0);
        assertThat(dto.isPlaying()).isTrue();
    }

    @Test
    void joinRoom_shouldAddParticipant() {
        when(roomRepository.findByRoomCode("nova-watch-7xk92")).thenReturn(Optional.of(room));
        when(memberRepository.findByRoomAndUser(room, participantUser)).thenReturn(Optional.empty());

        WatchRoomDto dto = watchService.joinRoom(participantUser, "nova-watch-7xk92");

        assertThat(dto.getRoomCode()).isEqualTo("nova-watch-7xk92");
        verify(memberRepository).save(any(WatchRoomMember.class));
    }

    @Test
    void endRoom_shouldThrowForbiddenWhenNotHost() {
        when(roomRepository.findByRoomCode("nova-watch-7xk92")).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> watchService.endRoom(participantUser, "nova-watch-7xk92"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Only the host can end this Watch Room");
    }

    @Test
    void saveChatMessage_shouldPersistAndReturnDto() {
        when(roomRepository.findByRoomCode("nova-watch-7xk92")).thenReturn(Optional.of(room));
        when(messageRepository.save(any(WatchRoomMessage.class))).thenAnswer(inv -> {
            WatchRoomMessage m = inv.getArgument(0);
            m.setId(500L);
            return m;
        });

        WatchChatMessageDto chatDto = watchService.saveChatMessage(hostUser, "nova-watch-7xk92", "Look at this scene!");

        assertThat(chatDto.getId()).isEqualTo(500L);
        assertThat(chatDto.getContent()).isEqualTo("Look at this scene!");
        assertThat(chatDto.getSenderId()).isEqualTo(1L);
    }
}
