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
        seedUserIfNotExists("demo@mystic.com", "Nova User", "password123", "MYST-DEMO01");
        seedUserIfNotExists("test@mystic.com", "Collaborator User", "password123", "MYST-TEST02");

        // Backfill tags for any existing users with null/empty tags
        List<User> usersWithoutTag = userRepository.findAll().stream()
                .filter(u -> u.getUserTag() == null || u.getUserTag().isBlank())
                .toList();

        for (User user : usersWithoutTag) {
            user.setUserTag(authService.generateUniqueUserTag());
            userRepository.save(user);
            log.info("Assigned unique userTag {} to user {}", user.getUserTag(), user.getEmail());
        }
    }

    private void seedUserIfNotExists(String email, String name, String rawPassword, String defaultTag) {
        if (!userRepository.existsByEmail(email)) {
            String tag = (defaultTag != null && !userRepository.existsByUserTag(defaultTag))
                    ? defaultTag
                    : authService.generateUniqueUserTag();
            User user = User.builder()
                    .email(email)
                    .name(name)
                    .password(passwordEncoder.encode(rawPassword))
                    .userTag(tag)
                    .build();
            userRepository.save(user);
            log.info("Seeded default test user: {} (Tag: {}, Password: {})", email, tag, rawPassword);
        }
    }
}
