package com.mystic.workspace.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "watch_rooms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WatchRoom {

    public enum Status { WAITING, ACTIVE, ENDED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_code", nullable = false, unique = true)
    private String roomCode;

    @Column(nullable = false)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "media_id", nullable = false)
    private WatchMedia media;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    @Builder.Default
    @Column(name = "current_position", nullable = false)
    private Double currentPosition = 0.0;

    @Builder.Default
    @Column(name = "is_playing", nullable = false)
    private boolean isPlaying = false;

    @Builder.Default
    @Column(name = "playback_rate", nullable = false)
    private Double playbackRate = 1.0;

    @Builder.Default
    @Column(name = "last_synced_at", nullable = false)
    private Instant lastSyncedAt = Instant.now();

    @Builder.Default
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<WatchRoomMember> members = new ArrayList<>();

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
