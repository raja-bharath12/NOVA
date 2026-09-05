package com.mystic.workspace.service;

import com.mystic.workspace.dto.EventDto;
import com.mystic.workspace.entity.Event;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;

    public List<EventDto> getAllForUser(User user) {
        return eventRepository.findByUserOrderByStartTimeAsc(user)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    public EventDto create(User user, EventDto dto) {
        Event event = Event.builder()
                .user(user)
                .title(dto.getTitle())
                .description(dto.getDescription())
                .startTime(dto.getStartTime())
                .endTime(dto.getEndTime())
                .location(dto.getLocation())
                .meetingLink(dto.getMeetingLink())
                .participants(dto.getParticipants())
                .build();
        return toDto(eventRepository.save(event));
    }

    public EventDto update(User user, Long eventId, EventDto dto) {
        Event event = findOwned(user, eventId);
        event.setTitle(dto.getTitle());
        event.setDescription(dto.getDescription());
        event.setStartTime(dto.getStartTime());
        event.setEndTime(dto.getEndTime());
        event.setLocation(dto.getLocation());
        event.setMeetingLink(dto.getMeetingLink());
        event.setParticipants(dto.getParticipants());
        return toDto(eventRepository.save(event));
    }

    public void delete(User user, Long eventId) {
        Event event = findOwned(user, eventId);
        eventRepository.delete(event);
    }

    private Event findOwned(User user, Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
        if (!event.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this event");
        }
        return event;
    }

    private EventDto toDto(Event event) {
        EventDto dto = new EventDto();
        dto.setId(event.getId());
        dto.setTitle(event.getTitle());
        dto.setDescription(event.getDescription());
        dto.setStartTime(event.getStartTime());
        dto.setEndTime(event.getEndTime());
        dto.setLocation(event.getLocation());
        dto.setMeetingLink(event.getMeetingLink());
        dto.setParticipants(event.getParticipants());
        return dto;
    }
}
