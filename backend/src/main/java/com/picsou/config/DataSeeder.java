package com.picsou.config;

import com.picsou.model.AppUser;
import com.picsou.model.FamilyMember;
import com.picsou.model.UserRole;
import com.picsou.repository.AppUserRepository;
import com.picsou.repository.FamilyMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final AppUserRepository userRepository;
    private final FamilyMemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.user.username}")
    private String username;

    @Value("${app.user.password-hash}")
    private String passwordHash;

    public DataSeeder(AppUserRepository userRepository, FamilyMemberRepository memberRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (userRepository.existsByUsername(username)) {
            return;
        }

        if (!passwordHash.startsWith("$2")) {
            throw new IllegalStateException(
                "APP_PASSWORD_HASH must be a valid bcrypt hash starting with $2a$, $2b$, or $2y$. " +
                "Generate one with: htpasswd -bnBC 12 \"\" your_password | tr -d ':\\n'"
            );
        }

        FamilyMember member = FamilyMember.builder()
            .displayName(username)
            .avatarColor("#6366f1")
            .managed(false)
            .build();
        memberRepository.save(member);

        AppUser user = AppUser.builder()
            .username(username)
            .passwordHash(passwordHash)
            .member(member)
            .role(UserRole.ADMIN)
            .activated(true)
            .acknowledgedWarning(true)
            .build();

        userRepository.save(user);
        log.info("Created application user: {} (ADMIN)", username);
    }
}
