package com.mystic.workspace.service;

import com.mystic.workspace.dto.AuthResponse;
import com.mystic.workspace.dto.LoginRequest;
import com.mystic.workspace.dto.RegisterRequest;
import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.security.JwtService;
import com.mystic.workspace.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.security.SecureRandom;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String TAG_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public String generateUniqueUserTag() {
        while (true) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 10; i++) {
                sb.append(TAG_CHARS.charAt(RANDOM.nextInt(TAG_CHARS.length())));
            }
            String tag = sb.toString();
            if (!userRepository.existsByUserTag(tag)) {
                return tag;
            }
        }
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        String userTag = generateUniqueUserTag();

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .userTag(userTag)
                .build();

        User saved = userRepository.save(user);
        UserPrincipal principal = new UserPrincipal(saved);
        String token = jwtService.generateToken(principal);

        return AuthResponse.builder()
                .token(token)
                .userId(saved.getId())
                .name(saved.getName())
                .email(saved.getEmail())
                .userTag(saved.getUserTag())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        // If existing user has no tag yet or has old demo tag, assign a real 10-character tag on login
        if (user.getUserTag() == null || user.getUserTag().isBlank() || user.getUserTag().contains("DEMO") || user.getUserTag().contains("TEST")) {
            user.setUserTag(generateUniqueUserTag());
            user = userRepository.save(user);
        }

        UserPrincipal principal = new UserPrincipal(user);
        String token = jwtService.generateToken(principal);

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .userTag(user.getUserTag())
                .build();
    }
}
