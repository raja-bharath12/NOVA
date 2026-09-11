package com.mystic.workspace.service;

import com.mystic.workspace.dto.MusicDtos;
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
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MusicService {

    private final MusicTrackRepository trackRepository;
    private final MusicRoomRepository roomRepository;
    private final MusicRoomMemberRepository memberRepository;
    private final MusicRoomQueueItemRepository queueRepository;
    private final MusicRoomMessageRepository messageRepository;
    private final StorageService storageService;

    private static final String CODE_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    // =========================================================================
    // 1. AUDIO TRACK MANAGEMENT
    // =========================================================================

    @Transactional
    public MusicDtos.TrackDto uploadTrack(MultipartFile file, String title, String artist, String album,
                                         Double duration, String coverArtUrl, User uploader) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Audio file is required");
        }

        if (file.getSize() > MusicDtos.MAX_AUDIO_FILE_SIZE) {
            double sizeInMb = file.getSize() / (1024.0 * 1024.0);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Audio file size (%.2f MB) exceeds the maximum limit of 200 MB.", sizeInMb));
        }

        String rawFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "audio.mp3";
        String cleanTitle = (title != null && !title.isBlank()) ? title.trim() : extractTitleFromFilename(rawFilename);
        String cleanArtist = (artist != null && !artist.isBlank()) ? artist.trim() : "Unknown Artist";
        String mimeType = file.getContentType() != null ? file.getContentType() : "audio/mpeg";

        String storageKey = storageService.store(file, "music/");

        MusicTrack track = MusicTrack.builder()
                .title(cleanTitle)
                .artist(cleanArtist)
                .album(album != null ? album.trim() : null)
                .originalFilename(rawFilename)
                .storageKey(storageKey)
                .mimeType(mimeType)
                .fileSize(file.getSize())
                .duration(duration != null && duration > 0 ? duration : 0.0)
                .coverArtUrl(coverArtUrl)
                .uploader(uploader)
                .build();

        MusicTrack saved = trackRepository.save(track);
        return mapToTrackDto(saved);
    }

    public List<MusicDtos.TrackDto> listTracks(User user) {
        return trackRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToTrackDto)
                .collect(Collectors.toList());
    }

    public MusicDtos.TrackDto getTrack(Long trackId) {
        MusicTrack track = trackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music track not found"));
        return mapToTrackDto(track);
    }

    public Resource loadTrackResource(Long trackId) {
        MusicTrack track = trackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music track not found"));
        return storageService.loadAsResource(track.getStorageKey());
    }

    public String getDirectStreamUrl(Long trackId) {
        MusicTrack track = trackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music track not found"));
        String directUrl = storageService.getDirectDownloadUrl(track.getStorageKey(), Duration.ofHours(24));
        return directUrl != null ? directUrl : ("/api/music/tracks/" + track.getId() + "/stream");
    }

    // =========================================================================
    // 2. MUSIC JAM ROOM MANAGEMENT
    // =========================================================================

    @Transactional
    public MusicDtos.RoomDto createRoom(MusicDtos.CreateRoomRequest request, User host) {
        String title = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle().trim()
                : (host.getName() + "'s Music Jam");

        String roomCode = generateUniqueRoomCode();

        MusicTrack initialTrack = null;
        if (request.getInitialTrackId() != null) {
            initialTrack = trackRepository.findById(request.getInitialTrackId()).orElse(null);
        }

        MusicRoom room = MusicRoom.builder()
                .roomCode(roomCode)
                .title(title)
                .host(host)
                .currentTrack(initialTrack)
                .currentPosition(0.0)
                .isPlaying(false)
                .playbackRate(1.0)
                .isCollaborative(request.getIsCollaborative() == null || request.getIsCollaborative())
                .status(MusicRoom.Status.ACTIVE)
                .lastSyncedAt(Instant.now())
                .build();

        MusicRoom savedRoom = roomRepository.save(room);

        // Add Host as first member
        MusicRoomMember hostMember = MusicRoomMember.builder()
                .room(savedRoom)
                .user(host)
                .role(MusicRoomMember.Role.HOST)
                .joinedAt(Instant.now())
                .build();
        memberRepository.save(hostMember);

        return getRoom(roomCode);
    }

    @Transactional(readOnly = true)
    public MusicDtos.RoomDto getRoom(String roomCode) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music Jam room not found"));

        List<MusicDtos.MemberDto> members = memberRepository.findByRoomAndLeftAtIsNull(room).stream()
                .map(m -> MusicDtos.MemberDto.builder()
                        .id(m.getId())
                        .userId(m.getUser().getId())
                        .userName(m.getUser().getName())
                        .userTag(m.getUser().getUserTag())
                        .email(m.getUser().getEmail())
                        .role(m.getRole().name())
                        .joinedAt(m.getJoinedAt())
                        .build())
                .collect(Collectors.toList());

        List<MusicDtos.QueueItemDto> queue = queueRepository.findByRoomOrderByOrderIndexAsc(room).stream()
                .map(q -> MusicDtos.QueueItemDto.builder()
                        .id(q.getId())
                        .track(mapToTrackDto(q.getTrack()))
                        .addedById(q.getAddedBy().getId())
                        .addedByName(q.getAddedBy().getName())
                        .orderIndex(q.getOrderIndex())
                        .addedAt(q.getAddedAt())
                        .build())
                .collect(Collectors.toList());

        return MusicDtos.RoomDto.builder()
                .id(room.getId())
                .roomCode(room.getRoomCode())
                .title(room.getTitle())
                .hostId(room.getHost().getId())
                .hostName(room.getHost().getName())
                .hostEmail(room.getHost().getEmail())
                .currentTrack(room.getCurrentTrack() != null ? mapToTrackDto(room.getCurrentTrack()) : null)
                .currentPosition(room.getCurrentPosition())
                .isPlaying(room.isPlaying())
                .playbackRate(room.getPlaybackRate())
                .isCollaborative(room.isCollaborative())
                .status(room.getStatus().name())
                .lastSyncedAt(room.getLastSyncedAt())
                .members(members)
                .queue(queue)
                .createdAt(room.getCreatedAt())
                .build();
    }

    @Transactional
    public MusicDtos.RoomDto joinRoom(String roomCode, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music Jam room not found"));

        boolean isHost = room.getHost().getId().equals(user.getId());

        Optional<MusicRoomMember> existing = memberRepository.findByRoomAndUser(room, user);
        if (existing.isPresent()) {
            MusicRoomMember member = existing.get();
            member.setLeftAt(null);
            if (isHost) member.setRole(MusicRoomMember.Role.HOST);
            memberRepository.save(member);
        } else {
            MusicRoomMember newMember = MusicRoomMember.builder()
                    .room(room)
                    .user(user)
                    .role(isHost ? MusicRoomMember.Role.HOST : MusicRoomMember.Role.LISTENER)
                    .joinedAt(Instant.now())
                    .build();
            memberRepository.save(newMember);
        }

        return getRoom(roomCode);
    }

    @Transactional
    public void leaveRoom(String roomCode, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase()).orElse(null);
        if (room != null) {
            memberRepository.findByRoomAndUser(room, user).ifPresent(m -> {
                m.setLeftAt(Instant.now());
                memberRepository.save(m);
            });
        }
    }

    @Transactional
    public MusicDtos.RoomDto updatePlaybackState(String roomCode, Double position, Boolean isPlaying, Double playbackRate, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        if (position != null && position >= 0) {
            room.setCurrentPosition(position);
        }
        if (isPlaying != null) {
            room.setPlaying(isPlaying);
        }
        if (playbackRate != null && playbackRate > 0) {
            room.setPlaybackRate(playbackRate);
        }
        room.setLastSyncedAt(Instant.now());
        roomRepository.save(room);

        return getRoom(roomCode);
    }

    @Transactional
    public MusicDtos.RoomDto changeTrack(String roomCode, Long trackId, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        MusicTrack track = trackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found"));

        room.setCurrentTrack(track);
        room.setCurrentPosition(0.0);
        room.setPlaying(true);
        room.setLastSyncedAt(Instant.now());
        roomRepository.save(room);

        return getRoom(roomCode);
    }

    // =========================================================================
    // 3. COLLABORATIVE QUEUE OPERATIONS
    // =========================================================================

    @Transactional
    public MusicDtos.RoomDto addToQueue(String roomCode, Long trackId, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        MusicTrack track = trackRepository.findById(trackId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Track not found"));

        List<MusicRoomQueueItem> currentQueue = queueRepository.findByRoomOrderByOrderIndexAsc(room);

        // If no track currently playing, set as current track directly
        if (room.getCurrentTrack() == null) {
            room.setCurrentTrack(track);
            room.setCurrentPosition(0.0);
            room.setPlaying(true);
            room.setLastSyncedAt(Instant.now());
            roomRepository.save(room);
            return getRoom(roomCode);
        }

        MusicRoomQueueItem item = MusicRoomQueueItem.builder()
                .room(room)
                .track(track)
                .addedBy(user)
                .orderIndex(currentQueue.size())
                .addedAt(Instant.now())
                .build();

        queueRepository.save(item);
        return getRoom(roomCode);
    }

    @Transactional
    public MusicDtos.RoomDto removeFromQueue(String roomCode, Long queueItemId, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        queueRepository.findById(queueItemId).ifPresent(item -> {
            if (item.getRoom().getId().equals(room.getId())) {
                queueRepository.delete(item);
            }
        });

        // Re-index remaining queue
        List<MusicRoomQueueItem> remaining = queueRepository.findByRoomOrderByOrderIndexAsc(room);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setOrderIndex(i);
            queueRepository.save(remaining.get(i));
        }

        return getRoom(roomCode);
    }

    @Transactional
    public MusicDtos.RoomDto advanceNextTrack(String roomCode, User user) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        List<MusicRoomQueueItem> currentQueue = queueRepository.findByRoomOrderByOrderIndexAsc(room);
        if (!currentQueue.isEmpty()) {
            MusicRoomQueueItem nextItem = currentQueue.get(0);
            room.setCurrentTrack(nextItem.getTrack());
            room.setCurrentPosition(0.0);
            room.setPlaying(true);
            room.setLastSyncedAt(Instant.now());
            roomRepository.save(room);

            queueRepository.delete(nextItem);

            // Re-index remaining items
            for (int i = 1; i < currentQueue.size(); i++) {
                currentQueue.get(i).setOrderIndex(i - 1);
                queueRepository.save(currentQueue.get(i));
            }
        } else {
            // Queue empty, keep track at end or stop
            room.setPlaying(false);
            room.setCurrentPosition(0.0);
            room.setLastSyncedAt(Instant.now());
            roomRepository.save(room);
        }

        return getRoom(roomCode);
    }

    // =========================================================================
    // 4. IN-ROOM CHAT
    // =========================================================================

    @Transactional
    public MusicDtos.ChatMessageDto addChatMessage(String roomCode, String content, User sender) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        if (content == null || content.trim().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Message content cannot be blank");
        }

        MusicRoomMessage msg = MusicRoomMessage.builder()
                .room(room)
                .sender(sender)
                .content(content.trim())
                .createdAt(Instant.now())
                .build();

        MusicRoomMessage saved = messageRepository.save(msg);

        return MusicDtos.ChatMessageDto.builder()
                .id(saved.getId())
                .roomCode(room.getRoomCode())
                .senderId(sender.getId())
                .senderName(sender.getName())
                .senderTag(sender.getUserTag())
                .content(saved.getContent())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    public List<MusicDtos.ChatMessageDto> getChatMessages(String roomCode) {
        MusicRoom room = roomRepository.findByRoomCode(roomCode.toLowerCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Music room not found"));

        return messageRepository.findByRoomOrderByCreatedAtAsc(room).stream()
                .map(m -> MusicDtos.ChatMessageDto.builder()
                        .id(m.getId())
                        .roomCode(room.getRoomCode())
                        .senderId(m.getSender().getId())
                        .senderName(m.getSender().getName())
                        .senderTag(m.getSender().getUserTag())
                        .content(m.getContent())
                        .createdAt(m.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private MusicDtos.TrackDto mapToTrackDto(MusicTrack track) {
        String streamUrl = storageService.getDirectDownloadUrl(track.getStorageKey(), Duration.ofHours(24));
        if (streamUrl == null) {
            streamUrl = "/api/music/tracks/" + track.getId() + "/stream";
        }

        return MusicDtos.TrackDto.builder()
                .id(track.getId())
                .title(track.getTitle())
                .artist(track.getArtist())
                .album(track.getAlbum())
                .originalFilename(track.getOriginalFilename())
                .storageKey(track.getStorageKey())
                .mimeType(track.getMimeType())
                .fileSize(track.getFileSize())
                .duration(track.getDuration())
                .coverArtUrl(track.getCoverArtUrl())
                .streamUrl(streamUrl)
                .uploaderId(track.getUploader().getId())
                .uploaderName(track.getUploader().getName())
                .createdAt(track.getCreatedAt())
                .build();
    }

    private String generateUniqueRoomCode() {
        while (true) {
            StringBuilder sb = new StringBuilder("jam-");
            for (int i = 0; i < 6; i++) {
                sb.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
            }
            String candidate = sb.toString();
            if (!roomRepository.existsByRoomCode(candidate)) {
                return candidate;
            }
        }
    }

    private String extractTitleFromFilename(String filename) {
        if (filename == null) return "Untitled Track";
        String clean = filename.replaceFirst("[.][^.]+$", ""); // remove extension
        return clean.replaceAll("[_\\-+]+", " ").trim();
    }
}
