package com.mystic.workspace.controller;

import io.livekit.server.AccessToken;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/livekit")
public class LiveKitController {

    @Value("${livekit.api.key:APIPVnJzdseSC2P}")
    private String apiKey;

    @Value("${livekit.api.secret:2o93DHX0FeBy6K1nGORTTxHw6mw8HbBvlMCpQaBGJcO}")
    private String apiSecret;

    @Value("${livekit.api.url:wss://nova-fawy0jmi.livekit.cloud}")
    private String livekitUrl;

    @GetMapping("/token")
    public ResponseEntity<Map<String, String>> getToken(
            @RequestParam String room,
            @AuthenticationPrincipal UserDetails userDetails) {

        String username = (userDetails != null && userDetails.getUsername() != null)
                ? userDetails.getUsername()
                : "Guest-" + System.currentTimeMillis();

        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setName(username);
        token.setIdentity(username);
        token.addGrants(new RoomJoin(true), new RoomName(room));

        return ResponseEntity.ok(Map.of(
                "token", token.toJwt(),
                "url", livekitUrl
        ));
    }
}
