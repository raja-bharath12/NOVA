package com.mystic.workspace.config;

import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import com.mystic.workspace.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    @Override
    public void run(String... args) {
        seedUserIfNotExists("demo@mystic.com", "Nova User", "password123");
        seedUserIfNotExists("test@mystic.com", "Collaborator User", "password123");

        // Backfill real 10-character tags for any existing users with null, empty, or legacy DEMO/TEST tags
        List<User> usersNeedingTag = userRepository.findAll().stream()
                .filter(u -> u.getUserTag() == null || u.getUserTag().isBlank() || u.getUserTag().contains("DEMO") || u.getUserTag().contains("TEST"))
                .toList();

        for (User user : usersNeedingTag) {
            user.setUserTag(authService.generateUniqueUserTag());
            userRepository.save(user);
            log.info("Assigned real unique 10-char userTag {} to user {}", user.getUserTag(), user.getEmail());
        }
    }

    private void seedUserIfNotExists(String email, String name, String rawPassword) {
        if (!userRepository.existsByEmail(email)) {
            String tag = authService.generateUniqueUserTag();
            User user = User.builder()
                    .email(email)
                    .name(name)
                    .password(passwordEncoder.encode(rawPassword))
                    .userTag(tag)
                    .build();
            userRepository.save(user);
            log.info("Seeded user: {} (Tag: {}, Password: {})", email, tag, rawPassword);
        }
    }
}
