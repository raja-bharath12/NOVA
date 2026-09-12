package com.mystic.workspace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mystic.workspace.dto.CallSignalDto;
import com.mystic.workspace.dto.PushSubscriptionDto;
import com.mystic.workspace.entity.PushSubscription;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Urgency;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final ObjectMapper objectMapper;

    @Value("${vapid.public.key:BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuYkr3qBUYIHBQFLXYp5Nksh8U}")
    private String vapidPublicKey;

    @Value("${vapid.private.key:UUxI1MmsmIhMmPjdu9y4i3c33m5WwQWz4s5yW7F2wEQ}")
    private String vapidPrivateKey;

    @Value("${vapid.subject:mailto:support@mysticworkspace.com}")
    private String vapidSubject;

    private PushService pushService;

    @PostConstruct
    public void init() {
        if (vapidPublicKey == null || vapidPublicKey.isBlank() || vapidPrivateKey == null || vapidPrivateKey.isBlank()) {
            log.info("WebPushService: VAPID keys not configured. Push notifications will be skipped.");
            return;
        }
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }

            pushService = new PushService();
            pushService.setPublicKey(vapidPublicKey.trim());
            pushService.setPrivateKey(vapidPrivateKey.trim());
            pushService.setSubject(vapidSubject.trim());
            log.info("WebPushService initialized successfully with VAPID subject: {}", vapidSubject);
        } catch (Exception e) {
            pushService = null;
            log.warn("WebPushService: VAPID key initialization bypassed ({}). Push notifications disabled until valid keys are supplied.", e.getMessage());
        }
    }

    public String getVapidPublicKey() {
        return vapidPublicKey;
    }

    @Transactional
    public void subscribe(User user, PushSubscriptionDto dto) {
        if (dto == null || dto.getEndpoint() == null || dto.getP256dh() == null || dto.getAuth() == null) {
            return;
        }

        String endpoint = dto.getEndpoint().trim();
        pushSubscriptionRepository.findByEndpoint(endpoint).ifPresentOrElse(
                existing -> {
                    existing.setUser(user);
                    existing.setP256dh(dto.getP256dh().trim());
                    existing.setAuth(dto.getAuth().trim());
                    existing.setCreatedAt(Instant.now());
                    pushSubscriptionRepository.save(existing);
                    log.info("Updated existing PushSubscription for user: {}", user.getEmail());
                },
                () -> {
                    PushSubscription newSub = PushSubscription.builder()
                            .user(user)
                            .endpoint(endpoint)
                            .p256dh(dto.getP256dh().trim())
                            .auth(dto.getAuth().trim())
                            .createdAt(Instant.now())
                            .build();
                    pushSubscriptionRepository.save(newSub);
                    log.info("Registered new PushSubscription for user: {}", user.getEmail());
                }
        );
    }

    @Transactional
    public void unsubscribe(String endpoint) {
        if (endpoint != null && !endpoint.isBlank()) {
            pushSubscriptionRepository.deleteByEndpoint(endpoint.trim());
            log.info("Unregistered PushSubscription endpoint: {}", endpoint);
        }
    }

    /**
     * Dispatches high-priority incoming audio/video call web push notification to recipient's registered devices.
     */
    @Async
    public void sendCallNotification(User recipient, User caller, CallSignalDto signal) {
        if (recipient == null || caller == null || pushService == null) return;

        List<PushSubscription> subscriptions = pushSubscriptionRepository.findByUserId(recipient.getId());
        if (subscriptions.isEmpty()) {
            log.debug("No web push subscriptions found for recipient user: {}", recipient.getEmail());
            return;
        }

        boolean isVideo = signal.isVideo();
        String callType = isVideo ? "VIDEO" : "AUDIO";

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "INCOMING_CALL");
        payload.put("title", "Incoming " + (isVideo ? "Video" : "Voice") + " Call");
        payload.put("body", caller.getName() + " is calling you...");
        payload.put("callerId", caller.getId());
        payload.put("callerName", caller.getName());
        payload.put("callerEmail", caller.getEmail());
        payload.put("callerTag", caller.getUserTag());
        payload.put("callType", callType);
        payload.put("isVideo", isVideo);
        payload.put("roomId", signal.getCallId() != null ? signal.getCallId() : "call_" + caller.getId() + "_" + recipient.getId());
        payload.put("url", "/?action=accept&callerId=" + caller.getId() + "&callerName=" + caller.getName() + "&isVideo=" + isVideo);
        payload.put("tag", "incoming-call-" + caller.getId());
        payload.put("timestamp", System.currentTimeMillis());

        sendToSubscriptions(subscriptions, payload, Urgency.HIGH, 30);
    }

    /**
     * Generic push notification dispatcher.
     */
    @Async
    public void sendNotification(User recipient, String title, String body, String targetUrl, String tag) {
        if (recipient == null || pushService == null) return;

        List<PushSubscription> subscriptions = pushSubscriptionRepository.findByUserId(recipient.getId());
        if (subscriptions.isEmpty()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "SYSTEM_ALERT");
        payload.put("title", title);
        payload.put("body", body);
        payload.put("url", targetUrl != null ? targetUrl : "/");
        payload.put("tag", tag != null ? tag : "nova-alert-" + System.currentTimeMillis());
        payload.put("timestamp", System.currentTimeMillis());

        sendToSubscriptions(subscriptions, payload, Urgency.NORMAL, 86400);
    }

    private void sendToSubscriptions(List<PushSubscription> subscriptions, Map<String, Object> payload, Urgency urgency, int ttlSeconds) {
        try {
            String payloadJson = objectMapper.writeValueAsString(payload);

            for (PushSubscription sub : subscriptions) {
                try {
                    Notification notification = Notification.builder()
                            .endpoint(sub.getEndpoint())
                            .userPublicKey(sub.getP256dh())
                            .userAuth(sub.getAuth())
                            .payload(payloadJson.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                            .urgency(urgency)
                            .ttl(ttlSeconds)
                            .build();

                    HttpResponse response = pushService.send(notification);
                    int statusCode = response.getStatusLine().getStatusCode();

                    if (statusCode == 201 || statusCode == 200) {
                        log.debug("Successfully delivered Web Push to endpoint: {}", sub.getEndpoint());
                    } else if (statusCode == 404 || statusCode == 410) {
                        log.warn("Web Push endpoint expired ({}), removing subscription: {}", statusCode, sub.getEndpoint());
                        pushSubscriptionRepository.delete(sub);
                    } else {
                        log.warn("Web Push returned status {}: {}", statusCode, response.getStatusLine().getReasonPhrase());
                    }
                } catch (Exception ex) {
                    String msg = ex.getMessage() != null ? ex.getMessage() : "";
                    if (msg.contains("404") || msg.contains("410") || msg.contains("NotRegistered") || msg.contains("invalid token")) {
                        log.warn("Deleting invalid/expired push subscription {}: {}", sub.getId(), msg);
                        try {
                            pushSubscriptionRepository.delete(sub);
                        } catch (Exception ignored) {}
                    } else {
                        log.error("Error sending push notification to subscription {}: {}", sub.getId(), msg);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to serialize or dispatch web push notification: {}", e.getMessage(), e);
        }
    }
}
