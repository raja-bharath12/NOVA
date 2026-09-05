package com.mystic.workspace.repository;

import com.mystic.workspace.entity.Event;
import com.mystic.workspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {
    List<Event> findByUserOrderByStartTimeAsc(User user);
    List<Event> findByUserAndStartTimeBetweenOrderByStartTimeAsc(User user, Instant from, Instant to);
    List<Event> findByUserId(Long userId);
    List<Event> findByUserIdOrderByStartTimeAsc(Long userId);
    List<Event> findByUserIdAndTitleContainingIgnoreCase(Long userId, String query);
}
