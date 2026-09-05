package com.mystic.workspace.controller;

import com.mystic.workspace.dto.TaskDto;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.UserPrincipal;
import com.mystic.workspace.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final UserRepository userRepository;

    @GetMapping
    public List<TaskDto> getAll(@AuthenticationPrincipal UserPrincipal principal) {
        return taskService.getAllForUser(currentUser(principal));
    }

    @PostMapping
    public TaskDto create(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody TaskDto dto) {
        return taskService.create(currentUser(principal), dto);
    }

    @PutMapping("/{id}")
    public TaskDto update(@AuthenticationPrincipal UserPrincipal principal,
                           @PathVariable Long id,
                           @Valid @RequestBody TaskDto dto) {
        return taskService.update(currentUser(principal), id, dto);
    }

    @PatchMapping("/{id}/toggle")
    public TaskDto toggle(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        return taskService.toggleComplete(currentUser(principal), id);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        taskService.delete(currentUser(principal), id);
    }

    private User currentUser(UserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
