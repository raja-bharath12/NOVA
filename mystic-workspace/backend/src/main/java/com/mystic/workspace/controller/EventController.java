package com.mystic.workspace.controller;

import com.mystic.workspace.dto.EventDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final UserRepository userRepository;

    @GetMapping
    public List<EventDto> getAll(@AuthenticationPrincipal UserPrincipal principal) {
        return eventService.getAllForUser(currentUser(principal));
    }

    @PostMapping
    public EventDto create(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody EventDto dto) {
        return eventService.create(currentUser(principal), dto);
    }

    @PutMapping("/{id}")
    public EventDto update(@AuthenticationPrincipal UserPrincipal principal,
                            @PathVariable Long id,
                            @Valid @RequestBody EventDto dto) {
        return eventService.update(currentUser(principal), id, dto);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        eventService.delete(currentUser(principal), id);
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
