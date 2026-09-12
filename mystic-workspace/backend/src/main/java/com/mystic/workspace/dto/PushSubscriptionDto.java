package com.mystic.workspace.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscriptionDto {

    private String endpoint;
    private KeysDto keys;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class KeysDto {
        private String p256dh;
        private String auth;
    }

    public String getP256dh() {
        return keys != null ? keys.getP256dh() : null;
    }

    public String getAuth() {
        return keys != null ? keys.getAuth() : null;
    }
}
