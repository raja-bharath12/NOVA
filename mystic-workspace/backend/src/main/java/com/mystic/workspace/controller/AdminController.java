package com.mystic.workspace.controller;

import com.mystic.workspace.dto.UserDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.entity.WatchRoom;
import com.mystic.workspace.repository.*;
import com.mystic.workspace.service.AuthService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final WatchRoomRepository watchRoomRepository;
    private final MeetingRepository meetingRepository;
    private final WatchMediaRepository watchMediaRepository;

    @Data
    @Builder
    public static class AdminStatsDto {
        private long totalUsers;
        private long totalMessages;
        private long totalFiles;
        private long totalWatchRooms;
        private long totalMeetings;
        private long totalMediaUploads;
        private long activeWatchRooms;
        private long activeMeetings;
        private long freeMemoryMB;
        private long totalMemoryMB;
        private long maxMemoryMB;
        private int availableProcessors;
        private String masterAdminEmail;
    }

    @Data
    public static class RoleUpdateRequest {
        private String role;
    }

    @Data
    @Builder
    public static class RoomSummaryDto {
        private String type; // WATCH or MEET
        private String roomCode;
        private String title;
        private String hostName;
        private String hostEmail;
        private String status;
        private int memberCount;
        private Instant createdAt;
    }

    @GetMapping("/stats")
    public AdminStatsDto getSystemStats() {
        Runtime runtime = Runtime.getRuntime();
        long freeMb = runtime.freeMemory() / (1024 * 1024);
        long totalMb = runtime.totalMemory() / (1024 * 1024);
        long maxMb = runtime.maxMemory() / (1024 * 1024);

        long activeWatchRooms = watchRoomRepository.findAll().stream()
                .filter(r -> r.getStatus() == WatchRoom.Status.ACTIVE)
                .count();

        long activeMeetings = meetingRepository.findAll().stream()
                .filter(m -> "ACTIVE".equalsIgnoreCase(m.getStatus().name()))
                .count();

        return AdminStatsDto.builder()
                .totalUsers(userRepository.count())
                .totalMessages(messageRepository.count())
                .totalFiles(fileMetadataRepository.count())
                .totalWatchRooms(watchRoomRepository.count())
                .totalMeetings(meetingRepository.count())
                .totalMediaUploads(watchMediaRepository.count())
                .activeWatchRooms(activeWatchRooms)
                .activeMeetings(activeMeetings)
                .freeMemoryMB(freeMb)
                .totalMemoryMB(totalMb)
                .maxMemoryMB(maxMb)
                .availableProcessors(runtime.availableProcessors())
                .masterAdminEmail(AuthService.MASTER_ADMIN_EMAIL)
                .build();
    }

    @GetMapping("/users")
    public List<UserDto> getAllUsers() {
        return userRepository.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
                .map(u -> UserDto.builder()
                        .id(u.getId())
                        .name(u.getName())
                        .email(u.getEmail())
                        .userTag(u.getUserTag())
                        .role(u.getRole() != null ? u.getRole() : "USER")
                        .createdAt(u.getCreatedAt())
                        .build())
                .toList();
    }

    @PutMapping("/users/{id}/role")
    public UserDto updateUserRole(@PathVariable Long id, @RequestBody RoleUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        String newRole = request.getRole() != null ? request.getRole().trim().toUpperCase() : "USER";
        if (!"ADMIN".equals(newRole) && !"USER".equals(newRole)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role must be ADMIN or USER");
        }

        // Prevent demoting master admin
        if (AuthService.MASTER_ADMIN_EMAIL.equalsIgnoreCase(user.getEmail()) && !"ADMIN".equals(newRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot demote master admin (" + AuthService.MASTER_ADMIN_EMAIL + ")");
        }

        user.setRole(newRole);
        User saved = userRepository.save(user);

        return UserDto.builder()
                .id(saved.getId())
                .name(saved.getName())
                .email(saved.getEmail())
                .userTag(saved.getUserTag())
                .role(saved.getRole())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    @DeleteMapping("/users/{id}")
    public Map<String, Object> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (AuthService.MASTER_ADMIN_EMAIL.equalsIgnoreCase(user.getEmail())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot delete master admin (" + AuthService.MASTER_ADMIN_EMAIL + ")");
        }

        userRepository.delete(user);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "User " + user.getEmail() + " deleted successfully.");
        return res;
    }

    @GetMapping("/rooms")
    public List<RoomSummaryDto> getAllRooms() {
        List<RoomSummaryDto> watchRooms = watchRoomRepository.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
                .map(r -> RoomSummaryDto.builder()
                        .type("WATCH")
                        .roomCode(r.getRoomCode())
                        .title(r.getTitle())
                        .hostName(r.getHost() != null ? r.getHost().getName() : "Unknown")
                        .hostEmail(r.getHost() != null ? r.getHost().getEmail() : "")
                        .status(r.getStatus() != null ? r.getStatus().name() : "ACTIVE")
                        .memberCount(r.getMembers() != null ? r.getMembers().size() : 0)
                        .createdAt(r.getCreatedAt())
                        .build())
                .toList();

        return watchRooms;
    }

    @DeleteMapping("/rooms/watch/{code}")
    public Map<String, Object> terminateWatchRoom(@PathVariable String code) {
        WatchRoom room = watchRoomRepository.findByRoomCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Watch room not found"));

        room.setStatus(WatchRoom.Status.ENDED);
        watchRoomRepository.save(room);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "Watch room " + code + " terminated by administrator.");
        return res;
    }

    @GetMapping("/files")
    public List<Map<String, Object>> getRecentFiles() {
        return fileMetadataRepository.findAll(Sort.by(Sort.Direction.DESC, "id")).stream()
                .limit(50)
                .map(f -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", f.getId());
                    item.put("filename", f.getOriginalFilename());
                    item.put("fileSize", f.getFileSize());
                    item.put("mimeType", f.getMimeType());
                    item.put("storageType", f.getStorageType() != null ? f.getStorageType().name() : "LOCAL");
                    item.put("createdAt", f.getCreatedAt());
                    item.put("ownerName", f.getOwner() != null ? f.getOwner().getName() : "Unknown");
                    item.put("ownerEmail", f.getOwner() != null ? f.getOwner().getEmail() : "");
                    return item;
                })
                .toList();
    }

    @DeleteMapping("/files/{id}")
    public Map<String, Object> deleteFile(@PathVariable Long id) {
        fileMetadataRepository.findById(id).ifPresent(fileMetadataRepository::delete);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "File metadata " + id + " deleted.");
        return res;
    }
}
