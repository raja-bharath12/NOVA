package com.mystic.workspace.service;

import com.mystic.workspace.dto.WatchChatMessageDto;
import com.mystic.workspace.dto.WatchMediaDto;
import com.mystic.workspace.dto.WatchRoomDto;
import com.mystic.workspace.dto.WatchUploadDtos;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import com.mystic.workspace.service.storage.StorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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
                .storageKey("watch-media/uuid-123/original/sample.mp4")
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
    @DisplayName("Verify 5 GB limit allows 100MB, 1GB, 3GB, 5GB and rejects >5GB")
    void test5GbValidation() {
        when(storageService.getStorageType()).thenReturn("S3");
        when(mediaRepository.save(any(WatchMedia.class))).thenAnswer(inv -> {
            WatchMedia m = inv.getArgument(0);
            m.setId(99L);
            return m;
        });

        // 100 MB -> Allowed
        WatchUploadDtos.InitResponse res100Mb = watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("short-100mb.mp4")
                .fileSize(100L * 1024 * 1024)
                .mimeType("video/mp4")
                .build());
        assertThat(res100Mb).isNotNull();

        // 1 GB -> Allowed
        WatchUploadDtos.InitResponse res1Gb = watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("hd-1gb.mp4")
                .fileSize(1024L * 1024 * 1024)
                .mimeType("video/mp4")
                .build());
        assertThat(res1Gb).isNotNull();

        // 3 GB -> Allowed
        WatchUploadDtos.InitResponse res3Gb = watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("fullhd-3gb.mp4")
                .fileSize(3L * 1024 * 1024 * 1024)
                .mimeType("video/mp4")
                .build());
        assertThat(res3Gb).isNotNull();

        // 5 GB -> Allowed
        WatchUploadDtos.InitResponse res5Gb = watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("4k-5gb.mp4")
                .fileSize(5L * 1024 * 1024 * 1024)
                .mimeType("video/mp4")
                .build());
        assertThat(res5Gb).isNotNull();

        // 5.1 GB -> Rejected
        assertThatThrownBy(() -> watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("oversize-5.1gb.mp4")
                .fileSize((long) (5.1 * 1024 * 1024 * 1024))
                .mimeType("video/mp4")
                .build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("exceeds the maximum allowed limit of 5.00 GB");

        // 6 GB -> Rejected
        assertThatThrownBy(() -> watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("oversize-6gb.mp4")
                .fileSize(6L * 1024 * 1024 * 1024)
                .mimeType("video/mp4")
                .build()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("exceeds the maximum allowed limit of 5.00 GB");
    }

    @Test
    @DisplayName("Verify Direct S3 Multipart Upload Lifecycle in WatchService")
    void testDirectS3MultipartUploadFlow() {
        when(storageService.getStorageType()).thenReturn("S3");
        when(storageService.initiateMultipartUpload(anyString(), anyString())).thenReturn("upload-xyz-123");
        when(storageService.generatePresignedPartUploadUrl(anyString(), anyString(), anyInt(), any(Duration.class)))
                .thenReturn("https://s3.ap-south-1.amazonaws.com/part-url");
        when(storageService.exists(anyString())).thenReturn(true);

        when(mediaRepository.save(any(WatchMedia.class))).thenAnswer(inv -> {
            WatchMedia m = inv.getArgument(0);
            if (m.getId() == null) m.setId(101L);
            return m;
        });
        when(mediaRepository.findById(101L)).thenReturn(Optional.of(
                WatchMedia.builder().id(101L).owner(hostUser).title("4K Movie").storageKey("watch-media/uuid/original/movie.mp4").fileSize(2000000000L).status(WatchMedia.Status.UPLOADING).build()
        ));

        // 1. Initiate 2 GB upload
        WatchUploadDtos.InitResponse initRes = watchService.initiateUpload(hostUser, WatchUploadDtos.InitRequest.builder()
                .filename("movie.mp4")
                .fileSize(2000000000L)
                .mimeType("video/mp4")
                .build());

        assertThat(initRes.getMediaId()).isEqualTo(101L);
        assertThat(initRes.getUploadId()).isEqualTo("upload-xyz-123");
        assertThat(initRes.getTotalParts()).isGreaterThan(1);

        // 2. Request Part URLs
        WatchUploadDtos.PartUrlsResponse partUrlsRes = watchService.getPartUploadUrls(hostUser, WatchUploadDtos.PartUrlsRequest.builder()
                .mediaId(101L)
                .uploadId("upload-xyz-123")
                .partNumbers(List.of(1, 2, 3))
                .build());

        assertThat(partUrlsRes.getPartUrls()).hasSize(3);
        assertThat(partUrlsRes.getPartUrls().get(1)).isEqualTo("https://s3.ap-south-1.amazonaws.com/part-url");

        // 3. Complete Upload
        WatchMediaDto completeRes = watchService.completeUpload(hostUser, WatchUploadDtos.CompleteRequest.builder()
                .mediaId(101L)
                .uploadId("upload-xyz-123")
                .parts(List.of(new WatchUploadDtos.CompletedPartDto(1, "\"etag1\"")))
                .build());

        assertThat(completeRes.getStatus()).isEqualTo(WatchMedia.Status.READY);
        verify(storageService).completeMultipartUpload(anyString(), eq("upload-xyz-123"), anyList());
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
