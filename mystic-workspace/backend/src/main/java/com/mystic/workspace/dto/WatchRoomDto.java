package com.mystic.workspace.dto;

import com.mystic.workspace.entity.WatchRoom;
import com.mystic.workspace.entity.WatchRoomMember;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WatchRoomDto {
    private Long id;
    private String roomCode;
    private String title;
    private WatchRoom.Status status;
    private WatchMediaDto media;
    private Long hostId;
    private String hostName;
    private Double currentPosition;
    private boolean isPlaying;
    private Double playbackRate;
    private Instant lastSyncedAt;
    private List<MemberInfo> members;
    private Instant createdAt;

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberInfo {
        private Long userId;
        private String name;
        private String email;
        private String userTag;
        private WatchRoomMember.Role role;
        private Instant joinedAt;
    }
}
