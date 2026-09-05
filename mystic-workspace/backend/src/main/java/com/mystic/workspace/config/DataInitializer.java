package com.mystic.workspace.config;

import com.mystic.workspace.entity.User;
import com.mystic.workspace.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        seedUserIfNotExists("demo@mystic.com", "Nova User", "password123");
        seedUserIfNotExists("test@mystic.com", "Collaborator User", "password123");
    }

    private void seedUserIfNotExists(String email, String name, String rawPassword) {
        if (!userRepository.existsByEmail(email)) {
            User user = User.builder()
                    .email(email)
                    .name(name)
                    .password(passwordEncoder.encode(rawPassword))
                    .build();
            userRepository.save(user);
            log.info("Seeded default test user: {} (Password: {})", email, rawPassword);
        }
    }
}
