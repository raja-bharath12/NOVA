package com.mystic.workspace.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "music_tracks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MusicTrack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Builder.Default
    @Column(nullable = false)
    private String artist = "Unknown Artist";

    private String album;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "storage_key", nullable = false, unique = true)
    private String storageKey;

    @Column(name = "mime_type", nullable = false)
    private String mimeType;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column
    private Double duration; // In seconds

    @Column(name = "cover_art_url", length = 1000)
    private String coverArtUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploader_id", nullable = false)
    private User uploader;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
