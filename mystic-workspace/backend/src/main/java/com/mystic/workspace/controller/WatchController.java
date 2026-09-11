package com.mystic.workspace.controller;

import com.mystic.workspace.dto.WatchChatMessageDto;
import com.mystic.workspace.dto.WatchMediaDto;
import com.mystic.workspace.dto.WatchRoomDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.WatchMedia;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.JwtService;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.WatchService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourceRegion;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/watch")
@RequiredArgsConstructor
@Slf4j
public class WatchController {

    private final WatchService watchService;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    // =========================================================================
    // 1. MEDIA ENDPOINTS
    // =========================================================================

    @PostMapping(value = "/media/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public WatchMediaDto uploadMedia(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title
    ) {
        return watchService.uploadMedia(currentUser(principal), file, title);
    }

    @GetMapping("/media")
    public List<WatchMediaDto> getMyMedia(@AuthenticationPrincipal UserPrincipal principal) {
        return watchService.getUserMedia(currentUser(principal));
    }

    @GetMapping("/media/{id}")
    public WatchMediaDto getMedia(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        return watchService.getMedia(currentUser(principal), id);
    }

    @DeleteMapping("/media/{id}")
    public ResponseEntity<Void> deleteMedia(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        watchService.deleteMedia(currentUser(principal), id);
        return ResponseEntity.noContent().build();
    }

    /**
     * HTTP 206 Partial Content video streaming endpoint supporting Range requests.
     * Accessible with Bearer header or token query parameter.
     */
    @GetMapping("/media/{id}/stream")
    public ResponseEntity<?> streamVideo(
            @PathVariable Long id,
            @RequestHeader HttpHeaders headers,
            @RequestParam(value = "token", required = false) String tokenParam,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws IOException {
        WatchMedia media = watchService.getMediaEntity(id);
        Resource videoResource = watchService.loadMediaResource(media);

        long contentLength = videoResource.contentLength();
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(media.getMimeType());
        } catch (Exception e) {
            mediaType = MediaType.parseMediaType("video/mp4");
        }

        List<HttpRange> ranges = headers.getRange();
        if (ranges.isEmpty()) {
            // Full stream fallback
            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .contentLength(contentLength)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .body(videoResource);
        }

        // Return Partial Content (206) for Range requests
        HttpRange range = ranges.get(0);
        long start = range.getRangeStart(contentLength);
        long end = range.getRangeEnd(contentLength);
        long rangeLength = Math.min(1024 * 1024 * 5, (end - start + 1)); // 5MB chunk max for smooth buffering

        ResourceRegion region = new ResourceRegion(videoResource, start, rangeLength);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .contentType(mediaType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + (start + rangeLength - 1) + "/" + contentLength)
                .body(region);
    }

    // =========================================================================
    // 2. ROOM ENDPOINTS
    // =========================================================================

    @Data
    public static class CreateRoomRequest {
        private Long mediaId;
        private String title;
    }

    @PostMapping("/rooms")
    public WatchRoomDto createRoom(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody CreateRoomRequest request
    ) {
        if (request.getMediaId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Media ID is required");
        }
        return watchService.createRoom(currentUser(principal), request.getMediaId(), request.getTitle());
    }

    @GetMapping("/rooms/{roomCode}")
    public WatchRoomDto getRoom(@PathVariable String roomCode) {
        return watchService.getRoomByCode(roomCode);
    }

    @PostMapping("/rooms/{roomCode}/join")
    public WatchRoomDto joinRoom(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        return watchService.joinRoom(currentUser(principal), roomCode);
    }

    @PostMapping("/rooms/{roomCode}/leave")
    public ResponseEntity<Void> leaveRoom(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        watchService.leaveRoom(currentUser(principal), roomCode);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/rooms/{roomCode}/end")
    public WatchRoomDto endRoom(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String roomCode
    ) {
        return watchService.endRoom(currentUser(principal), roomCode);
    }

    @GetMapping("/rooms/{roomCode}/messages")
    public List<WatchChatMessageDto> getMessages(@PathVariable String roomCode) {
        return watchService.getRoomMessages(roomCode);
    }

    // =========================================================================
    // 3. AUTH HELPER
    // =========================================================================

    private User currentUser(UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
