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

    public static boolean isValidUsernameFormat(String username) {
        if (username == null) return false;
        String u = username.trim().toLowerCase();
        if (u.length() < 3 || u.length() > 30) return false;
        if (!u.matches("^[a-z0-9_.]{3,30}$")) return false;
        if (u.startsWith(".") || u.endsWith(".")) return false;
        if (u.contains("..")) return false;
        return true;
    }

    public static String sanitizeUsername(String raw) {
        if (raw == null) return "";
        return raw.trim().toLowerCase().replaceAll("^@+", "");
    }

    public boolean isUsernameAvailable(String rawUsername) {
        String cleaned = sanitizeUsername(rawUsername);
        if (!isValidUsernameFormat(cleaned)) {
            return false;
        }
        return !userRepository.existsByUserTagIgnoreCase(cleaned);
    }

    public String generateUniqueUserTag() {
        while (true) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 8; i++) {
                sb.append(TAG_CHARS.charAt(RANDOM.nextInt(TAG_CHARS.length())));
            }
            String tag = sb.toString().toLowerCase();
            if (!userRepository.existsByUserTagIgnoreCase(tag)) {
                return tag;
            }
        }
    }

    public String generateUsernameFromName(String name, String email) {
        String base = "";
        if (name != null && !name.isBlank()) {
            base = name.trim().toLowerCase().replaceAll("[^a-z0-9_.]", "_");
        } else if (email != null && email.contains("@")) {
            base = email.substring(0, email.indexOf('@')).toLowerCase().replaceAll("[^a-z0-9_.]", "_");
        } else {
            base = "user";
        }
        base = base.replaceAll("^_+|_+$", "");
        if (base.length() < 3) base = base + "_nova";
        if (base.length() > 20) base = base.substring(0, 20);

        String candidate = base;
        int count = 1;
        while (userRepository.existsByUserTagIgnoreCase(candidate) || !isValidUsernameFormat(candidate)) {
            candidate = base + "_" + (100 + RANDOM.nextInt(900));
            count++;
            if (count > 20) {
                candidate = "user_" + System.currentTimeMillis() % 100000;
                break;
            }
        }
        return candidate;
    }

    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        String chosenTag;
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            chosenTag = sanitizeUsername(request.getUsername());
            if (!isValidUsernameFormat(chosenTag)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Username must be 3-30 characters, lowercase (a-z, 0-9, _, .), and cannot start/end with a dot.");
            }
            if (userRepository.existsByUserTagIgnoreCase(chosenTag)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Username '@" + chosenTag + "' is already taken. Please choose another.");
            }
        } else {
            chosenTag = generateUsernameFromName(request.getName(), request.getEmail());
        }

        User user = User.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .userTag(chosenTag)
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
        String identifier = request.getEmail() != null ? request.getEmail().trim() : "";
        String cleanIdentifier = sanitizeUsername(identifier);

        // Find user by either email or username handle
        User user = userRepository.findByEmail(identifier.toLowerCase())
                .or(() -> userRepository.findByUserTagIgnoreCase(cleanIdentifier))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(user.getEmail(), request.getPassword())
        );

        if (user.getUserTag() == null || user.getUserTag().isBlank() || user.getUserTag().contains("DEMO") || user.getUserTag().contains("TEST")) {
            user.setUserTag(generateUsernameFromName(user.getName(), user.getEmail()));
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
