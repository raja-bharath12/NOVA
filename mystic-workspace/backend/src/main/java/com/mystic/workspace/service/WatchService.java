package com.mystic.workspace.service;

import com.mystic.workspace.dto.WatchChatMessageDto;
import com.mystic.workspace.dto.WatchMediaDto;
import com.mystic.workspace.dto.WatchRoomDto;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import com.mystic.workspace.service.storage.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WatchService {

    private final WatchMediaRepository mediaRepository;
    private final WatchRoomRepository roomRepository;
    private final WatchRoomMemberRepository memberRepository;
    private final WatchRoomMessageRepository messageRepository;
    private final StorageService storageService;

    private static final String CODE_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    // =========================================================================
    // 1. MEDIA MANAGEMENT
    // =========================================================================

    @Transactional
    public WatchMediaDto uploadMedia(User user, MultipartFile file, String title) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File cannot be empty");
        }

        String mimeType = file.getContentType();
        if (mimeType == null || !mimeType.toLowerCase().startsWith("video/")) {
            // Default to mp4 if unspecified but valid video container
            mimeType = "video/mp4";
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "video.mp4";
        String effectiveTitle = (title != null && !title.isBlank()) ? title.trim() : originalFilename;

        String storageKey = storageService.store(file);

        WatchMedia media = WatchMedia.builder()
                .owner(user)
                .title(effectiveTitle)
                .originalFilename(originalFilename)
                .storageKey(storageKey)
                .mimeType(mimeType)
                .fileSize(file.getSize())
                .status(WatchMedia.Status.READY)
                .build();

        WatchMedia saved = mediaRepository.save(media);
        log.info("WatchMedia uploaded: id={}, title={}, size={}", saved.getId(), saved.getTitle(), saved.getFileSize());
        return toMediaDto(saved);
    }

    public List<WatchMediaDto> getUserMedia(User user) {
        return mediaRepository.findByOwnerOrderByCreatedAtDesc(user)
                .stream()
                .map(this::toMediaDto)
                .collect(Collectors.toList());
    }

    public WatchMedia getMediaEntity(Long mediaId) {
        return mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Media not found"));
    }

    public WatchMediaDto getMedia(User user, Long mediaId) {
        WatchMedia media = getMediaEntity(mediaId);
        return toMediaDto(media);
    }

    @Transactional
    public void deleteMedia(User user, Long mediaId) {
        WatchMedia media = getMediaEntity(mediaId);
        if (!media.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this media");
        }

        FileMetadata fakeMeta = FileMetadata.builder().storageKey(media.getStorageKey()).build();
        storageService.delete(fakeMeta);
        mediaRepository.delete(media);
        log.info("WatchMedia deleted: id={}", mediaId);
    }

    public Resource loadMediaResource(WatchMedia media) {
        FileMetadata meta = FileMetadata.builder()
                .storageKey(media.getStorageKey())
                .originalFilename(media.getOriginalFilename())
                .mimeType(media.getMimeType())
                .build();
        return storageService.loadAsResource(meta);
    }

    // =========================================================================
    // 2. WATCH ROOM MANAGEMENT
    // =========================================================================

    @Transactional
    public WatchRoomDto createRoom(User user, Long mediaId, String title) {
        WatchMedia media = getMediaEntity(mediaId);

        String roomCode = generateUniqueRoomCode();
        String roomTitle = (title != null && !title.isBlank()) ? title.trim() : media.getTitle() + " Watch Party";

        WatchRoom room = WatchRoom.builder()
                .roomCode(roomCode)
                .title(roomTitle)
                .media(media)
                .host(user)
                .status(WatchRoom.Status.ACTIVE)
                .currentPosition(0.0)
                .isPlaying(false)
                .playbackRate(1.0)
                .lastSyncedAt(Instant.now())
                .build();

        WatchRoom savedRoom = roomRepository.save(room);

        // Register host as initial active member
        WatchRoomMember member = WatchRoomMember.builder()
                .room(savedRoom)
                .user(user)
                .role(WatchRoomMember.Role.HOST)
                .joinedAt(Instant.now())
                .build();
        memberRepository.save(member);

        log.info("WatchRoom created: code={}, host={}, media={}", roomCode, user.getEmail(), media.getTitle());
        return toRoomDto(savedRoom);
    }

    public WatchRoomDto getRoomByCode(String roomCode) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch Room not found"));

        return toRoomDto(room);
    }

    @Transactional
    public WatchRoomDto joinRoom(User user, String roomCode) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch Room not found"));

        if (room.getStatus() == WatchRoom.Status.ENDED) {
            throw new ResponseStatusException(HttpStatus.GONE, "This Watch Room has ended");
        }

        WatchRoomMember member = memberRepository.findByRoomAndUser(room, user).orElse(null);
        if (member == null) {
            WatchRoomMember.Role role = room.getHost().getId().equals(user.getId())
                    ? WatchRoomMember.Role.HOST
                    : WatchRoomMember.Role.PARTICIPANT;

            member = WatchRoomMember.builder()
                    .room(room)
                    .user(user)
                    .role(role)
                    .joinedAt(Instant.now())
                    .build();
            memberRepository.save(member);
        } else {
            member.setLeftAt(null);
            memberRepository.save(member);
        }

        log.info("User {} joined WatchRoom {}", user.getEmail(), roomCode);
        return toRoomDto(room);
    }

    @Transactional
    public void leaveRoom(User user, String roomCode) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room != null) {
            memberRepository.findByRoomAndUser(room, user).ifPresent(m -> {
                m.setLeftAt(Instant.now());
                memberRepository.save(m);
            });
            log.info("User {} left WatchRoom {}", user.getEmail(), roomCode);
        }
    }

    @Transactional
    public WatchRoomDto endRoom(User user, String roomCode) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch Room not found"));

        if (!room.getHost().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the host can end this Watch Room");
        }

        room.setStatus(WatchRoom.Status.ENDED);
        room.setPlaying(false);
        room.setUpdatedAt(Instant.now());
        WatchRoom ended = roomRepository.save(room);

        // Mark all active members left
        List<WatchRoomMember> activeMembers = memberRepository.findByRoomAndLeftAtIsNull(room);
        activeMembers.forEach(m -> m.setLeftAt(Instant.now()));
        memberRepository.saveAll(activeMembers);

        log.info("WatchRoom {} ended by host {}", roomCode, user.getEmail());
        return toRoomDto(ended);
    }

    @Transactional
    public void updatePlaybackState(String roomCode, Double position, Boolean isPlaying, Double playbackRate) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode).orElse(null);
        if (room != null) {
            if (position != null) {
                room.setCurrentPosition(Math.max(0.0, position));
            }
            if (isPlaying != null) {
                room.setPlaying(isPlaying);
            }
            if (playbackRate != null && playbackRate > 0) {
                room.setPlaybackRate(playbackRate);
            }
            room.setLastSyncedAt(Instant.now());
            room.setUpdatedAt(Instant.now());
            roomRepository.save(room);
        }
    }

    // =========================================================================
    // 3. CHAT MESSAGES
    // =========================================================================

    @Transactional
    public WatchChatMessageDto saveChatMessage(User sender, String roomCode, String content) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch Room not found"));

        WatchRoomMessage msg = WatchRoomMessage.builder()
                .room(room)
                .sender(sender)
                .content(content.trim())
                .createdAt(Instant.now())
                .build();

        WatchRoomMessage saved = messageRepository.save(msg);
        return toMessageDto(saved);
    }

    public List<WatchChatMessageDto> getRoomMessages(String roomCode) {
        WatchRoom room = roomRepository.findByRoomCode(roomCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch Room not found"));

        return messageRepository.findByRoomOrderByCreatedAtAsc(room)
                .stream()
                .map(this::toMessageDto)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // 4. HELPERS & MAPPERS
    // =========================================================================

    private String generateUniqueRoomCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder("nova-watch-");
            for (int i = 0; i < 5; i++) {
                sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String code = sb.toString();
            if (roomRepository.findByRoomCode(code).isEmpty()) {
                return code;
            }
        }
        return "nova-watch-" + System.currentTimeMillis();
    }

    public WatchMediaDto toMediaDto(WatchMedia media) {
        return WatchMediaDto.builder()
                .id(media.getId())
                .title(media.getTitle())
                .originalFilename(media.getOriginalFilename())
                .storageKey(media.getStorageKey())
                .mimeType(media.getMimeType())
                .fileSize(media.getFileSize())
                .duration(media.getDuration())
                .thumbnailUrl(media.getThumbnailUrl())
                .manifestUrl(media.getManifestUrl())
                .streamUrl("/api/watch/media/" + media.getId() + "/stream")
                .status(media.getStatus())
                .ownerId(media.getOwner().getId())
                .ownerName(media.getOwner().getName())
                .createdAt(media.getCreatedAt())
                .build();
    }

    public WatchRoomDto toRoomDto(WatchRoom room) {
        // Calculate authoritative current playback position with elapsed time if playing
        double authoritativePosition = room.getCurrentPosition();
        if (room.isPlaying() && room.getLastSyncedAt() != null) {
            long elapsedMillis = Duration.between(room.getLastSyncedAt(), Instant.now()).toMillis();
            double elapsedSeconds = (elapsedMillis / 1000.0) * (room.getPlaybackRate() != null ? room.getPlaybackRate() : 1.0);
            authoritativePosition += elapsedSeconds;
        }

        List<WatchRoomMember> activeMembers = memberRepository.findByRoomAndLeftAtIsNull(room);
        List<WatchRoomDto.MemberInfo> memberDtos = activeMembers.stream()
                .map(m -> WatchRoomDto.MemberInfo.builder()
                        .userId(m.getUser().getId())
                        .name(m.getUser().getName())
                        .email(m.getUser().getEmail())
                        .role(m.getRole())
                        .joinedAt(m.getJoinedAt())
                        .build())
                .collect(Collectors.toList());

        return WatchRoomDto.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .title(room.getTitle())
                .status(room.getStatus())
                .media(toMediaDto(room.getMedia()))
                .hostId(room.getHost().getId())
                .hostName(room.getHost().getName())
                .currentPosition(authoritativePosition)
                .isPlaying(room.isPlaying())
                .playbackRate(room.getPlaybackRate())
                .lastSyncedAt(room.getLastSyncedAt())
                .members(memberDtos)
                .createdAt(room.getCreatedAt())
                .build();
    }

    public WatchChatMessageDto toMessageDto(WatchRoomMessage msg) {
        return WatchChatMessageDto.builder()
                .id(msg.getId())
                .roomCode(msg.getRoom().getRoomCode())
                .senderId(msg.getSender().getId())
                .senderName(msg.getSender().getName())
                .senderEmail(msg.getSender().getEmail())
                .content(msg.getContent())
                .createdAt(msg.getCreatedAt())
                .build();
    }
}
