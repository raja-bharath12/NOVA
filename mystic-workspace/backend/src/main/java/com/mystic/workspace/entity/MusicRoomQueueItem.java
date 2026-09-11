package com.mystic.workspace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "music_room_queue")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicRoomQueueItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private MusicRoom room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "track_id", nullable = false)
    private MusicTrack track;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "added_by_id", nullable = false)
    private User addedBy;

    @Builder.Default
    @Column(name = "order_index", nullable = false)
    private Integer orderIndex = 0;

    @Builder.Default
    @Column(name = "added_at", nullable = false)
    private Instant addedAt = Instant.now();
}
