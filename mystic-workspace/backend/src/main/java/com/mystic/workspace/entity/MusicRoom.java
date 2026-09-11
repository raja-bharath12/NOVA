package com.mystic.workspace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "music_rooms")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicRoom {

    public enum Status { ACTIVE, PAUSED, ENDED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_code", nullable = false, unique = true)
    private String roomCode;

    @Column(nullable = false)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_id", nullable = false)
    private User host;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_track_id")
    private MusicTrack currentTrack;

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
    @Column(name = "is_collaborative", nullable = false)
    private boolean isCollaborative = true;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Status status = Status.ACTIVE;

    @Builder.Default
    @Column(name = "last_synced_at", nullable = false)
    private Instant lastSyncedAt = Instant.now();

    @Builder.Default
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MusicRoomMember> members = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MusicRoomQueueItem> queue = new ArrayList<>();

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
