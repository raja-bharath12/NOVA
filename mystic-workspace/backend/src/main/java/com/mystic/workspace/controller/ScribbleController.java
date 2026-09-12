package com.mystic.workspace.controller;

import com.mystic.workspace.dto.ScribbleDtos.*;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.service.ScribbleGameService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping({"/api/scribble", "/scribble", "/api/api/scribble"})
@RequiredArgsConstructor
@Slf4j
public class ScribbleController {

    private final ScribbleGameService scribbleService;
    private final UserRepository userRepository;

    @PostMapping("/rooms")
    public ResponseEntity<RoomState> createRoom(@RequestBody(required = false) CreateRoomRequest req, Principal principal) {
        User user = resolveUser(principal);
        CreateRoomRequest safeReq = req != null ? req : new CreateRoomRequest();
        RoomState room = scribbleService.createRoom(user, safeReq);
        return ResponseEntity.ok(room);
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<RoomState>> listPublicRooms() {
        return ResponseEntity.ok(scribbleService.listPublicRooms());
    }

    @GetMapping("/rooms/{roomCode}")
    public ResponseEntity<RoomState> getRoom(@PathVariable String roomCode, Principal principal) {
        User user = resolveUser(principal);
        Long userId = user != null ? user.getId() : null;
        RoomState room = scribbleService.getRoomState(roomCode, userId);
        if (room == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(room);
    }

    @PostMapping("/rooms/{roomCode}/join")
    public ResponseEntity<RoomState> joinRoom(
            @PathVariable String roomCode,
            @RequestBody(required = false) JoinRoomRequest guestReq,
            Principal principal
    ) {
        User user = resolveUser(principal);
        try {
            RoomState room = scribbleService.joinRoom(roomCode, user, guestReq);
            if (room == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(room);
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    @GetMapping("/rooms/{roomCode}/canvas")
    public ResponseEntity<List<DrawAction>> getCanvasSnapshot(@PathVariable String roomCode) {
        ScribbleGameService.RoomInstance room = scribbleService.getRoom(roomCode);
        if (room == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(room.getCurrentCanvasActions());
    }

    private User resolveUser(Principal principal) {
        if (principal == null) return null;
        return userRepository.findByEmail(principal.getName()).orElse(null);
    }
}
