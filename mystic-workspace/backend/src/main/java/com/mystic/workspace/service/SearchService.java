package com.mystic.workspace.service;

import com.mystic.workspace.dto.GlobalSearchResultDto;
import com.mystic.workspace.entity.*;
import com.mystic.workspace.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final TaskRepository taskRepository;
    private final EventRepository eventRepository;
    private final MessageRepository messageRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final MeetingRepository meetingRepository;
    private final WhiteboardRepository whiteboardRepository;

    @Transactional(readOnly = true)
    public List<GlobalSearchResultDto> searchWorkspace(User currentUser, String query) {
        List<GlobalSearchResultDto> results = new ArrayList<>();
        if (query == null || query.isBlank()) return results;

        String q = query.trim().toLowerCase();

        // 1. Search Tasks
        List<Task> tasks = taskRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getId());
        for (Task t : tasks) {
            if (t.getTitle().toLowerCase().contains(q) || (t.getDescription() != null && t.getDescription().toLowerCase().contains(q))) {
                results.add(GlobalSearchResultDto.builder()
                        .id("task-" + t.getId())
                        .type("TASK")
                        .title(t.getTitle())
                        .description(t.getDescription())
                        .subtitle(t.getPriority().name() + " Priority • " + (t.isCompleted() ? "Completed" : "Pending"))
                        .url("/tasks")
                        .tag(t.getCategory() != null ? t.getCategory() : "Task")
                        .build());
            }
        }

        // 2. Search Calendar Events
        List<Event> events = eventRepository.findByUserIdOrderByStartTimeAsc(currentUser.getId());
        for (Event e : events) {
            if (e.getTitle().toLowerCase().contains(q) || (e.getDescription() != null && e.getDescription().toLowerCase().contains(q))) {
                results.add(GlobalSearchResultDto.builder()
                        .id("event-" + e.getId())
                        .type("EVENT")
                        .title(e.getTitle())
                        .description(e.getDescription())
                        .subtitle(e.getLocation() != null ? e.getLocation() : "Calendar Event")
                        .timestamp(e.getStartTime())
                        .url("/calendar")
                        .tag("Event")
                        .build());
            }
        }

        // 3. Search Chat Messages
        try {
            List<Message> messages = messageRepository.searchAllMessagesForUser(currentUser.getId(), q);
            for (Message m : messages) {
                results.add(GlobalSearchResultDto.builder()
                        .id("msg-" + m.getId())
                        .type("MESSAGE")
                        .title(m.getContent())
                        .subtitle("Chat from " + m.getSender().getName())
                        .ownerName(m.getSender().getName())
                        .timestamp(m.getCreatedAt())
                        .url("/chat")
                        .tag("Chat")
                        .build());
            }
        } catch (Exception ignored) {
        }

        // 4. Search Files
        List<FileMetadata> files = fileMetadataRepository.searchByFilename(currentUser.getId(), q);
        for (FileMetadata f : files) {
            results.add(GlobalSearchResultDto.builder()
                    .id("file-" + f.getId())
                    .type("FILE")
                    .title(f.getOriginalFilename())
                    .subtitle((f.getFileSize() / 1024) + " KB • " + f.getMimeType())
                    .ownerName(f.getOwner().getName())
                    .timestamp(f.getCreatedAt())
                    .url("/files")
                    .tag(f.getStorageType().name())
                    .build());
        }

        // 5. Search Meetings
        List<Meeting> meetings = meetingRepository.findAllForUser(currentUser.getId());
        for (Meeting m : meetings) {
            if (m.getTitle().toLowerCase().contains(q) || m.getRoomCode().toLowerCase().contains(q)) {
                results.add(GlobalSearchResultDto.builder()
                        .id("meeting-" + m.getId())
                        .type("MEETING")
                        .title(m.getTitle())
                        .subtitle("Room: " + m.getRoomCode() + " • " + m.getStatus().name())
                        .ownerName(m.getHost().getName())
                        .timestamp(m.getCreatedAt())
                        .url("/meetings/room/" + m.getRoomCode())
                        .tag(m.getStatus().name())
                        .build());
            }
        }

        // 6. Search Whiteboards
        List<Whiteboard> whiteboards = whiteboardRepository.searchByTitle(currentUser.getId(), q);
        for (Whiteboard w : whiteboards) {
            results.add(GlobalSearchResultDto.builder()
                    .id("board-" + w.getId())
                    .type("WHITEBOARD")
                    .title(w.getTitle())
                    .subtitle("Collaborative Whiteboard")
                    .ownerName(w.getOwner().getName())
                    .timestamp(w.getUpdatedAt())
                    .url("/whiteboard")
                    .tag("Canvas")
                    .build());
        }

        return results;
    }
}
