package com.mystic.workspace.controller;

import com.mystic.workspace.dto.AuthResponse;
import com.mystic.workspace.dto.LoginRequest;
import com.mystic.workspace.dto.RegisterRequest;
import com.mystic.workspace.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/check-username")
    public ResponseEntity<?> checkUsername(@RequestParam("username") String username) {
        boolean available = authService.isUsernameAvailable(username);
        boolean validFormat = AuthService.isValidUsernameFormat(AuthService.sanitizeUsername(username));
        String message = !validFormat
                ? "Username must be 3-30 lowercase characters (a-z, 0-9, _, .)"
                : (available ? "Username is available" : "Username is already taken");

        return ResponseEntity.ok(java.util.Map.of(
                "available", available,
                "validFormat", validFormat,
                "username", AuthService.sanitizeUsername(username),
                "message", message
        ));
    }
}
