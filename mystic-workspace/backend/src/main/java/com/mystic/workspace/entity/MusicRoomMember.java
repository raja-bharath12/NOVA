package com.mystic.workspace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "music_room_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"room_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicRoomMember {

    public enum Role { HOST, DJ, LISTENER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_id", nullable = false)
    private MusicRoom room;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Role role = Role.LISTENER;

    @Builder.Default
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt = Instant.now();

    @Column(name = "left_at")
    private Instant leftAt;
}
