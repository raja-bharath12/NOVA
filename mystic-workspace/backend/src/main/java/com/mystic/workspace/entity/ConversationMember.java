package com.mystic.workspace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "conversation_members", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"conversation_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationMember {

    public enum Role {
        ADMIN,
        MEMBER
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private Role role = Role.MEMBER;

    @Builder.Default
    @Column(nullable = false)
    private Instant joinedAt = Instant.now();

    @Builder.Default
    @Column(nullable = false)
    private Instant lastReadAt = Instant.now();
}
