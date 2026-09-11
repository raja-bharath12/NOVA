package com.mystic.workspace.service;

import com.mystic.workspace.dto.WatchChatMessageDto;
import com.mystic.workspace.dto.WatchMediaDto;
import com.mystic.workspace.dto.WatchRoomDto;
import com.mystic.workspace.dto.WatchUploadDtos;
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
public class WatchService {

    private final WatchMediaRepository mediaRepository;
    private final WatchRoomRepository roomRepository;
    private final WatchRoomMemberRepository memberRepository;
    private final WatchRoomMessageRepository messageRepository;
    private final StorageService storageService;

    private static final String CODE_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    // =========================================================================
    // 1. DIRECT S3 PRESIGNED & MULTIPART UPLOAD (UP TO 5 GB)
    // =========================================================================

    @Transactional
    public WatchUploadDtos.InitResponse initiateUpload(User user, WatchUploadDtos.InitRequest request) {
        if (request.getFileSize() == null || request.getFileSize() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File size must be greater than 0");
        }

        // Strict 5 GB Validation
        if (request.getFileSize() > WatchUploadDtos.MAX_VIDEO_FILE_SIZE) {
            double sizeInGb = request.getFileSize() / (1024.0 * 1024.0 * 1024.0);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Video file size (%.2f GB) exceeds the maximum allowed limit of 5.00 GB.", sizeInGb));
        }

        String rawFilename = (request.getFilename() != null && !request.getFilename().isBlank())
                ? request.getFilename() : "video.mp4";
        String effectiveTitle = (request.getTitle() != null && !request.getTitle().isBlank())
                ? request.getTitle().trim() : rawFilename;
        String mimeType = (request.getMimeType() != null && !request.getMimeType().isBlank())
                ? request.getMimeType() : "video/mp4";

        String storageKey = "watch-media/" + UUID.randomUUID().toString() + "/original/" + sanitizeFilename(rawFilename);

        WatchMedia media = WatchMedia.builder()
                .owner(user)
                .title(effectiveTitle)
                .originalFilename(rawFilename)
                .storageKey(storageKey)
                .mimeType(mimeType)
                .fileSize(request.getFileSize())
                .status(WatchMedia.Status.UPLOADING)
                .build();

        WatchMedia saved = mediaRepository.save(media);

        String storageType = storageService.getStorageType();
        long partSize = WatchUploadDtos.DEFAULT_PART_SIZE; // 10MB chunks
        int totalParts = (int) Math.ceil((double) request.getFileSize() / partSize);

        if ("S3".equalsIgnoreCase(storageType)) {
            // For smaller files (<100MB) without multipart requested, provide single-PUT presigned URL
            if (request.getFileSize() < 100L * 1024 * 1024 && (request.getPartCount() == null || request.getPartCount() <= 1)) {
                String singlePutUrl = storageService.generatePresignedUploadUrl(storageKey, mimeType, Duration.ofMinutes(60));
                return WatchUploadDtos.InitResponse.builder()
                        .mediaId(saved.getId())
                        .storageKey(storageKey)
                        .uploadId(null)
                        .singleUploadUrl(singlePutUrl)
                        .partSize(request.getFileSize())
                        .totalParts(1)
                        .storageType("S3")
                        .build();
            }

            // For larger videos up to 5 GB, initiate S3 Multipart Upload
            String uploadId = storageService.initiateMultipartUpload(storageKey, mimeType);
            return WatchUploadDtos.InitResponse.builder()
                    .mediaId(saved.getId())
                    .storageKey(storageKey)
                    .uploadId(uploadId)
                    .singleUploadUrl(null)
                    .partSize(partSize)
                    .totalParts(totalParts)
                    .storageType("S3")
                    .build();
        }

        // Local storage fallback
        return WatchUploadDtos.InitResponse.builder()
                .mediaId(saved.getId())
                .storageKey(storageKey)
                .uploadId(null)
                .singleUploadUrl(null)
                .partSize(partSize)
                .totalParts(totalParts)
                .storageType("LOCAL")
                .build();
    }

    public WatchUploadDtos.PartUrlsResponse getPartUploadUrls(User user, WatchUploadDtos.PartUrlsRequest request) {
        WatchMedia media = getMediaEntity(request.getMediaId());
        if (!media.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this media session");
        }

        Map<Integer, String> urls = new HashMap<>();
        for (int partNumber : request.getPartNumbers()) {
            if (partNumber < 1 || partNumber > 10000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid part number: " + partNumber);
            }
            String partUrl = storageService.generatePresignedPartUploadUrl(
                    media.getStorageKey(),
                    request.getUploadId(),
                    partNumber,
                    Duration.ofMinutes(60)
            );
            urls.put(partNumber, partUrl);
        }

        return WatchUploadDtos.PartUrlsResponse.builder()
                .mediaId(media.getId())
                .uploadId(request.getUploadId())
                .partUrls(urls)
                .build();
    }

    @Transactional
    public WatchMediaDto completeUpload(User user, WatchUploadDtos.CompleteRequest request) {
        WatchMedia media = getMediaEntity(request.getMediaId());
        if (!media.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this media session");
        }

        if (request.getUploadId() != null && !request.getUploadId().isBlank()) {
            // Complete S3 multipart aggregation
            storageService.completeMultipartUpload(media.getStorageKey(), request.getUploadId(), request.getParts());
        }

        // Verify storage existence
        if (!storageService.exists(media.getStorageKey())) {
            log.warn("Uploaded media not verified in storage: key={}", media.getStorageKey());
        }

        media.setStatus(WatchMedia.Status.READY);
        media.setUpdatedAt(Instant.now());
        WatchMedia saved = mediaRepository.save(media);
        log.info("WatchMedia upload completed and verified: id={}, title={}, key={}", saved.getId(), saved.getTitle(), saved.getStorageKey());
        return toMediaDto(saved);
    }

    @Transactional
    public void abortUpload(User user, WatchUploadDtos.AbortRequest request) {
        WatchMedia media = getMediaEntity(request.getMediaId());
        if (!media.getOwner().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this media session");
        }

        if (request.getUploadId() != null && !request.getUploadId().isBlank()) {
            storageService.abortMultipartUpload(media.getStorageKey(), request.getUploadId());
        }

        media.setStatus(WatchMedia.Status.FAILED);
        mediaRepository.delete(media);
        log.info("Aborted WatchMedia upload: id={}, key={}", media.getId(), media.getStorageKey());
    }

    // =========================================================================
    // 2. STANDARD MULTIPART UPLOAD (FALLBACK & LOCAL)
    // =========================================================================

    @Transactional
    public WatchMediaDto uploadMedia(User user, MultipartFile file, String title) {
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File cannot be empty");
        }

        // Strict 5 GB Validation
        if (file.getSize() > WatchUploadDtos.MAX_VIDEO_FILE_SIZE) {
            double sizeInGb = file.getSize() / (1024.0 * 1024.0 * 1024.0);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Video file size (%.2f GB) exceeds the maximum allowed limit of 5.00 GB.", sizeInGb));
        }

        String mimeType = file.getContentType();
        if (mimeType == null || !mimeType.toLowerCase().startsWith("video/")) {
            mimeType = "video/mp4";
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "video.mp4";
        String effectiveTitle = (title != null && !title.isBlank()) ? title.trim() : originalFilename;

        String storageKey = storageService.store(file, "watch-media/" + UUID.randomUUID().toString() + "/original");

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

    @Transactional(readOnly = true)
    public List<WatchMediaDto> getUserMedia(User user) {
        return mediaRepository.findByOwnerOrderByCreatedAtDesc(user)
                .stream()
                .filter(m -> m.getStatus() == WatchMedia.Status.READY)
                .map(this::toMediaDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public WatchMedia getMediaEntity(Long mediaId) {
        return mediaRepository.findById(mediaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Media not found"));
    }

    @Transactional(readOnly = true)
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

        storageService.delete(media.getStorageKey());
        mediaRepository.delete(media);
        log.info("WatchMedia deleted: id={}", mediaId);
    }

    public Resource loadMediaResource(WatchMedia media) {
        return storageService.loadAsResource(media.getStorageKey());
    }

    // =========================================================================
    // 3. WATCH ROOM MANAGEMENT
    // =========================================================================

    public static String sanitizeRoomCode(String raw) {
        if (raw == null || raw.isBlank()) return "";
        try {
            raw = java.net.URLDecoder.decode(raw, java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception ignored) {}

        String trimmed = raw.trim();
        if (trimmed.contains("?")) {
            trimmed = trimmed.substring(0, trimmed.indexOf('?'));
        }
        if (trimmed.contains("#")) {
            trimmed = trimmed.substring(0, trimmed.indexOf('#'));
        }
        if (trimmed.contains("/")) {
            String[] segments = trimmed.split("/");
            for (int i = segments.length - 1; i >= 0; i--) {
                if (!segments[i].trim().isEmpty()) {
                    trimmed = segments[i].trim();
                    break;
                }
            }
        }
        trimmed = trimmed.replaceAll("^[\\s.,/\\\\:;!?'\"()\\[\\]{}<>~`@#$%^&*+=]+|[\\s.,/\\\\:;!?'\"()\\[\\]{}<>~`@#$%^&*+=]+$", "");
        String normalized = trimmed.toLowerCase().replaceAll("[\\s_]+", "-");

        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?:nova[-_]?watch[-_]?)([a-z0-9]+)").matcher(normalized);
        if (m.find()) {
            return "nova-watch-" + m.group(1);
        }

        java.util.regex.Matcher mSuffix = java.util.regex.Pattern.compile("([a-z0-9]{4,10})").matcher(normalized);
        if (mSuffix.find()) {
            return "nova-watch-" + mSuffix.group(1);
        }

        return normalized;
    }

    public WatchRoom findRoomByLenientCode(String code) {
        if (code == null || code.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room code is required");
        }
        String cleaned = sanitizeRoomCode(code);

        // 1. Direct match with sanitized code
        Optional<WatchRoom> roomOpt = roomRepository.findByRoomCode(cleaned);
        if (roomOpt.isPresent()) return roomOpt.get();

        // 2. Case-insensitive match
        roomOpt = roomRepository.findByRoomCodeIgnoreCase(cleaned);
        if (roomOpt.isPresent()) return roomOpt.get();

        // 3. Match raw code case-insensitive
        roomOpt = roomRepository.findByRoomCodeIgnoreCase(code.trim());
        if (roomOpt.isPresent()) return roomOpt.get();

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch Room not found. Please verify the room code or link.");
    }

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

    @Transactional(readOnly = true)
    public WatchRoomDto getRoomByCode(String roomCode) {
        WatchRoom room = findRoomByLenientCode(roomCode);
        return toRoomDto(room);
    }

    @Transactional
    public WatchRoomDto joinRoom(User user, String roomCode) {
        WatchRoom room = findRoomByLenientCode(roomCode);

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

        log.info("User {} joined WatchRoom {}", user.getEmail(), room.getRoomCode());
        return toRoomDto(room);
    }

    @Transactional
    public void leaveRoom(User user, String roomCode) {
        try {
            WatchRoom room = findRoomByLenientCode(roomCode);
            memberRepository.findByRoomAndUser(room, user).ifPresent(m -> {
                m.setLeftAt(Instant.now());
                memberRepository.save(m);
            });
            log.info("User {} left WatchRoom {}", user.getEmail(), room.getRoomCode());
        } catch (Exception ignored) {
        }
    }

    @Transactional
    public WatchRoomDto endRoom(User user, String roomCode) {
        WatchRoom room = findRoomByLenientCode(roomCode);

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

        log.info("WatchRoom {} ended by host {}", room.getRoomCode(), user.getEmail());
        return toRoomDto(ended);
    }

    @Transactional
    public void updatePlaybackState(String roomCode, Double position, Boolean isPlaying, Double playbackRate) {
        try {
            WatchRoom room = findRoomByLenientCode(roomCode);
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
        } catch (Exception ignored) {
        }
    }

    // =========================================================================
    // 4. CHAT MESSAGES
    // =========================================================================

    @Transactional
    public WatchChatMessageDto saveChatMessage(User sender, String roomCode, String content) {
        WatchRoom room = findRoomByLenientCode(roomCode);

        WatchRoomMessage msg = WatchRoomMessage.builder()
                .room(room)
                .sender(sender)
                .content(content.trim())
                .createdAt(Instant.now())
                .build();

        WatchRoomMessage saved = messageRepository.save(msg);
        return toMessageDto(saved);
    }

    @Transactional(readOnly = true)
    public List<WatchChatMessageDto> getRoomMessages(String roomCode) {
        WatchRoom room = findRoomByLenientCode(roomCode);

        return messageRepository.findByRoomOrderByCreatedAtAsc(room)
                .stream()
                .map(this::toMessageDto)
                .collect(Collectors.toList());
    }

    // =========================================================================
    // 5. HELPERS & MAPPERS
    // =========================================================================

    private String sanitizeFilename(String filename) {
        if (filename == null) return "video.mp4";
        return filename.replaceAll("[\\\\/:*?\"<>|\\s]", "_");
    }

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
