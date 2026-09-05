package com.mystic.workspace.repository;

import com.mystic.workspace.entity.Task;
import com.mystic.workspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByUserOrderByCreatedAtDesc(User user);
    List<Task> findByUserAndCompletedOrderByDeadlineAsc(User user, boolean completed);
    List<Task> findByUserId(Long userId);
    List<Task> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Task> findByUserIdAndTitleContainingIgnoreCaseOrUserIdAndDescriptionContainingIgnoreCase(Long userId1, String query1, Long userId2, String query2);
}
