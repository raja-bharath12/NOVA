package com.mystic.workspace.service;

import com.mystic.workspace.dto.TaskDto;
import com.mystic.workspace.entity.Task;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;

    public List<TaskDto> getAllForUser(User user) {
        return taskRepository.findByUserOrderByCreatedAtDesc(user)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public TaskDto create(User user, TaskDto dto) {
        Task task = Task.builder()
                .user(user)
                .title(dto.getTitle())
                .description(dto.getDescription())
                .priority(dto.getPriority() != null ? dto.getPriority() : Task.Priority.MEDIUM)
                .category(dto.getCategory())
                .deadline(dto.getDeadline())
                .completed(false)
                .build();
        return toDto(taskRepository.save(task));
    }

    public TaskDto update(User user, Long taskId, TaskDto dto) {
        Task task = findOwned(user, taskId);
        task.setTitle(dto.getTitle());
        task.setDescription(dto.getDescription());
        task.setPriority(dto.getPriority());
        task.setCategory(dto.getCategory());
        task.setDeadline(dto.getDeadline());
        return toDto(taskRepository.save(task));
    }

    public TaskDto toggleComplete(User user, Long taskId) {
        Task task = findOwned(user, taskId);
        task.setCompleted(!task.isCompleted());
        return toDto(taskRepository.save(task));
    }

    public void delete(User user, Long taskId) {
        Task task = findOwned(user, taskId);
        taskRepository.delete(task);
    }

    private Task findOwned(User user, Long taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        if (!task.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this task");
        }
        return task;
    }

    private TaskDto toDto(Task task) {
        TaskDto dto = new TaskDto();
        dto.setId(task.getId());
        dto.setTitle(task.getTitle());
        dto.setDescription(task.getDescription());
        dto.setPriority(task.getPriority());
        dto.setCategory(task.getCategory());
        dto.setDeadline(task.getDeadline());
        dto.setCompleted(task.isCompleted());
        return dto;
    }
}
