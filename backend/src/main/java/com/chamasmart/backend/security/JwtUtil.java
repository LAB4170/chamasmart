package com.chamasmart.backend.security;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
@Component
public class JwtUtil {
    @Value("${app.security.jwt.secret}")
    private String jwtSecret;
    @Value("${app.security.jwt.expiration-ms}")
    private long jwtExpirationMs;
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.core.env.Environment environment;

    /**
     * Production must run with a strong private secret. Elsewhere (local development, tests) a missing secret is replaced by a
     * random one for this run, so nothing weak is ever shared through the repository.
     */
    @jakarta.annotation.PostConstruct
    void checkSecret() {
        boolean weak = jwtSecret == null || jwtSecret.isBlank() || jwtSecret.contains("placeholder") || jwtSecret.length() < 32;
        if (!weak) return;
        boolean prod = java.util.Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (prod) {
            throw new IllegalStateException("JWT_SECRET must be set to a private value of at least 32 characters in production");
        }
        byte[] random = new byte[48];
        new java.security.SecureRandom().nextBytes(random);
        jwtSecret = java.util.Base64.getEncoder().encodeToString(random);
        org.slf4j.LoggerFactory.getLogger(JwtUtil.class).warn("JWT_SECRET is not set. Using a random secret for this run only; sessions end when the server restarts.");
    }
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }
    public Long extractUserId(String token) {
        Claims claims = extractAllClaims(token);
        if (claims.get("id") != null) {
            return ((Number) claims.get("id")).longValue();
        }
        return null;
    }
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }
    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }
    public String generateToken(CustomUserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("id", userDetails.getUserId());
        claims.put("role", userDetails.getAuthorities().iterator().next().getAuthority());
        claims.put("email", userDetails.getUsername());
        return createToken(claims, userDetails.getUsername());
    }
    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(getSigningKey())
                .compact();
    }
    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }
}

