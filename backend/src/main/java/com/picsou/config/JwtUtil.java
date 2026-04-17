package com.picsou.config;

import com.picsou.model.AppUser;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey signingKey;
    private final long accessExpiryMinutes;
    private final long refreshExpiryDays;

    public JwtUtil(
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.access-token-expiry-minutes:15}") long accessExpiryMinutes,
        @Value("${app.jwt.refresh-token-expiry-days:7}") long refreshExpiryDays
    ) {
        // Ensure the key is at least 256 bits for HS256
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters (256 bits)");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.accessExpiryMinutes = accessExpiryMinutes;
        this.refreshExpiryDays = refreshExpiryDays;
    }

    public String generateAccessToken(AppUser user) {
        return buildToken(user, "access", Instant.now().plus(accessExpiryMinutes, ChronoUnit.MINUTES));
    }

    public String generateRefreshToken(AppUser user) {
        return buildToken(user, "refresh", Instant.now().plus(refreshExpiryDays, ChronoUnit.DAYS));
    }

    private String buildToken(AppUser user, String tokenType, Instant expiry) {
        return Jwts.builder()
            .subject(user.getUsername())
            .claim("uid", user.getId())
            .claim("role", user.getRole().name())
            .claim("type", tokenType)
            .issuedAt(Date.from(Instant.now()))
            .expiration(Date.from(expiry))
            .signWith(signingKey)
            .compact();
    }

    public Claims validateAndParse(String token) {
        return Jwts.parser()
            .verifyWith(signingKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public boolean isRefreshToken(Claims claims) {
        return "refresh".equals(claims.get("type", String.class));
    }

    public boolean isAccessToken(Claims claims) {
        return "access".equals(claims.get("type", String.class));
    }

    public long getRefreshExpirySeconds() {
        return refreshExpiryDays * 24 * 60 * 60;
    }

    public long getAccessExpirySeconds() {
        return accessExpiryMinutes * 60;
    }
}
