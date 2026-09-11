package com.mystic.workspace.controller;

import com.mystic.workspace.dto.MusicDtos;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.MusicService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
@Slf4j
public class MusicController {

    private final MusicService musicService;
    private final UserRepository userRepository;

    // =========================================================================
    // 1. TRACKS
    // =========================================================================

    @PostMapping(value = "/tracks/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MusicDtos.TrackDto uploadTrack(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "artist", required = false) String artist,
            @RequestParam(value = "album", required = false) String album,
            @RequestParam(value = "duration", required = false) Double duration,
            @RequestParam(value = "coverArtUrl", required = false) String coverArtUrl,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.uploadTrack(file, title, artist, album, duration, coverArtUrl, currentUser(principal));
    }

    @GetMapping("/tracks")
    public List<MusicDtos.TrackDto> listTracks(@AuthenticationPrincipal UserPrincipal principal) {
        return musicService.listTracks(currentUser(principal));
    }

    @GetMapping("/tracks/{id}")
    public MusicDtos.TrackDto getTrack(@PathVariable Long id) {
        return musicService.getTrack(id);
    }

    @GetMapping("/tracks/{id}/stream")
    public ResponseEntity<?> streamTrack(@PathVariable Long id) {
        String directUrl = musicService.getDirectStreamUrl(id);
        if (directUrl.startsWith("http://") || directUrl.startsWith("https://")) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(directUrl))
                    .build();
        }

        Resource resource = musicService.loadTrackResource(id);
        MusicDtos.TrackDto track = musicService.getTrack(id);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, track.getMimeType() != null ? track.getMimeType() : "audio/mpeg")
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .body(resource);
    }

    // =========================================================================
    // 2. ROOMS
    // =========================================================================

    @PostMapping("/rooms")
    public MusicDtos.RoomDto createRoom(
            @RequestBody MusicDtos.CreateRoomRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.createRoom(request, currentUser(principal));
    }

    @GetMapping("/rooms/{roomCode}")
    public MusicDtos.RoomDto getRoom(@PathVariable String roomCode) {
        return musicService.getRoom(roomCode);
    }

    @PostMapping("/rooms/{roomCode}/join")
    public MusicDtos.RoomDto joinRoom(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.joinRoom(roomCode, currentUser(principal));
    }

    @PostMapping("/rooms/{roomCode}/leave")
    public Map<String, Object> leaveRoom(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserPrincipal principal) {
        musicService.leaveRoom(roomCode, currentUser(principal));
        return Map.of("success", true, "message", "Left room successfully");
    }

    @PostMapping("/rooms/{roomCode}/playback")
    public MusicDtos.RoomDto updatePlayback(
            @PathVariable String roomCode,
            @RequestParam(required = false) Double position,
            @RequestParam(required = false) Boolean isPlaying,
            @RequestParam(required = false) Double playbackRate,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.updatePlaybackState(roomCode, position, isPlaying, playbackRate, currentUser(principal));
    }

    @PostMapping("/rooms/{roomCode}/track")
    public MusicDtos.RoomDto changeTrack(
            @PathVariable String roomCode,
            @RequestBody MusicDtos.ChangeTrackRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.changeTrack(roomCode, request.getTrackId(), currentUser(principal));
    }

    // =========================================================================
    // 3. QUEUE
    // =========================================================================

    @PostMapping("/rooms/{roomCode}/queue")
    public MusicDtos.RoomDto addToQueue(
            @PathVariable String roomCode,
            @RequestBody MusicDtos.AddToQueueRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.addToQueue(roomCode, request.getTrackId(), currentUser(principal));
    }

    @DeleteMapping("/rooms/{roomCode}/queue/{itemId}")
    public MusicDtos.RoomDto removeFromQueue(
            @PathVariable String roomCode,
            @PathVariable Long itemId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.removeFromQueue(roomCode, itemId, currentUser(principal));
    }

    @PostMapping("/rooms/{roomCode}/queue/next")
    public MusicDtos.RoomDto advanceNextTrack(
            @PathVariable String roomCode,
            @AuthenticationPrincipal UserPrincipal principal) {
        return musicService.advanceNextTrack(roomCode, currentUser(principal));
    }

    // =========================================================================
    // 4. CHAT
    // =========================================================================

    @GetMapping("/rooms/{roomCode}/messages")
    public List<MusicDtos.ChatMessageDto> getMessages(@PathVariable String roomCode) {
        return musicService.getChatMessages(roomCode);
    }

    @PostMapping("/rooms/{roomCode}/messages")
    public MusicDtos.ChatMessageDto sendMessage(
            @PathVariable String roomCode,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal UserPrincipal principal) {
        String content = payload.get("content");
        return musicService.addChatMessage(roomCode, content, currentUser(principal));
    }

    // =========================================================================
    // AUTH HELPER
    // =========================================================================

    private User currentUser(UserPrincipal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
