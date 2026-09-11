package com.mystic.workspace.service;

import com.mystic.workspace.dto.TaskDto;
import com.mystic.workspace.entity.Task;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    private User userA;
    private User userB;
    private Task taskA;

    @BeforeEach
    void setUp() {
        userA = User.builder().id(1L).email("userA@test.com").name("User A").password("hash").build();
        userB = User.builder().id(2L).email("userB@test.com").name("User B").password("hash").build();

        taskA = Task.builder()
                .id(100L)
                .user(userA)
                .title("Complete project report")
                .description("Q3 retrospective analysis")
                .priority(Task.Priority.HIGH)
                .category("Work")
                .deadline(LocalDate.of(2026, 9, 15))
                .completed(false)
                .createdAt(Instant.parse("2026-09-11T10:00:00Z"))
                .build();
    }

    @Test
    void create_shouldSaveTaskAndReturnDtoWithCreatedAt() {
        TaskDto input = TaskDto.builder()
                .title("Complete project report")
                .description("Q3 retrospective analysis")
                .priority(Task.Priority.HIGH)
                .category("Work")
                .deadline(LocalDate.of(2026, 9, 15))
                .build();

        when(taskRepository.save(any(Task.class))).thenReturn(taskA);

        TaskDto result = taskService.create(userA, input);

        assertThat(result.getId()).isEqualTo(100L);
        assertThat(result.getTitle()).isEqualTo("Complete project report");
        assertThat(result.getPriority()).isEqualTo(Task.Priority.HIGH);
        assertThat(result.getCreatedAt()).isNotNull();
        assertThat(result.isCompleted()).isFalse();
    }

    @Test
    void getAllForUser_shouldReturnOnlyUserTasks() {
        when(taskRepository.findByUserOrderByCreatedAtDesc(userA)).thenReturn(List.of(taskA));

        List<TaskDto> list = taskService.getAllForUser(userA);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).getTitle()).isEqualTo("Complete project report");
    }

    @Test
    void toggleComplete_shouldToggleAndPersist() {
        when(taskRepository.findById(100L)).thenReturn(Optional.of(taskA));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        TaskDto toggled = taskService.toggleComplete(userA, 100L);

        assertThat(toggled.isCompleted()).isTrue();
    }

    @Test
    void findOwned_shouldThrowForbiddenWhenUserDoesNotOwnTask() {
        when(taskRepository.findById(100L)).thenReturn(Optional.of(taskA));

        assertThatThrownBy(() -> taskService.delete(userB, 100L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("You do not have access to this task");
    }
}
