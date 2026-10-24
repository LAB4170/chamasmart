package com.chamasmart.backend.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.LocatorAdapter;
import io.jsonwebtoken.ProtectedHeader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.security.PublicKey;
import java.security.cert.CertificateFactory;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * Verifies a Firebase ID token's signature, issuer, audience and expiry against Google's published keys.
 * Nothing about the caller's identity is trusted until this succeeds.
 */
@Component
public class FirebaseTokenVerifier {
    public record Identity(String uid, String email, boolean emailVerified, String name) {}

    private static final String CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

    private final String projectId;
    private final Function<String, PublicKey> keyById;

    private volatile Map<String, PublicKey> cache = Map.of();
    private volatile long cacheLoadedAt = 0;

    @Autowired
    public FirebaseTokenVerifier(@Value("${app.firebase.project-id:chamasmart-1c600}") String projectId) {
        this.projectId = projectId;
        this.keyById = this::googleKey;
    }

    /** For tests: supply keys directly. */
    FirebaseTokenVerifier(String projectId, Function<String, PublicKey> keyById) {
        this.projectId = projectId;
        this.keyById = keyById;
    }

    public Identity verify(String idToken) {
        if (idToken == null || idToken.isBlank()) throw new SecurityException("Missing sign-in token");
        try {
            Jws<Claims> jws = Jwts.parser()
                    .keyLocator(new LocatorAdapter<Key>() {
                        @Override
                        protected Key locate(ProtectedHeader header) {
                            PublicKey k = header.getKeyId() == null ? null : keyById.apply(header.getKeyId());
                            if (k == null) throw new JwtException("Unknown signing key");
                            return k;
                        }
                    })
                    .requireIssuer("https://securetoken.google.com/" + projectId)
                    .requireAudience(projectId)
                    .build()
                    .parseSignedClaims(idToken);
            if (!"RS256".equals(jws.getHeader().getAlgorithm())) throw new JwtException("Unexpected algorithm");
            Claims c = jws.getPayload();
            String uid = c.getSubject();
            String email = c.get("email", String.class);
            if (uid == null || uid.isBlank() || email == null || email.isBlank()) throw new JwtException("Token has no identity");
            boolean verified = Boolean.TRUE.equals(c.get("email_verified", Boolean.class));
            return new Identity(uid, email.trim().toLowerCase(), verified, c.get("name", String.class));
        } catch (JwtException | IllegalArgumentException e) {
            throw new SecurityException("Invalid sign-in token");
        }
    }

    private PublicKey googleKey(String kid) {
        long now = System.currentTimeMillis();
        PublicKey k = cache.get(kid);
        // Refresh hourly, and at most once a minute when an unknown key id shows up.
        if (k != null && now - cacheLoadedAt < Duration.ofHours(1).toMillis()) return k;
        if (k == null && now - cacheLoadedAt < Duration.ofMinutes(1).toMillis()) return null;
        synchronized (this) {
            try {
                HttpResponse<String> res = HttpClient.newHttpClient().send(
                        HttpRequest.newBuilder(URI.create(CERT_URL)).timeout(Duration.ofSeconds(5)).build(),
                        HttpResponse.BodyHandlers.ofString());
                Map<String, String> pems = new ObjectMapper().readValue(res.body(), new TypeReference<Map<String, String>>() {});
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                Map<String, PublicKey> fresh = new HashMap<>();
                for (Map.Entry<String, String> e : pems.entrySet()) {
                    fresh.put(e.getKey(), cf.generateCertificate(new ByteArrayInputStream(e.getValue().getBytes(StandardCharsets.UTF_8))).getPublicKey());
                }
                cache = fresh;
                cacheLoadedAt = now;
            } catch (Exception e) {
                cacheLoadedAt = now;
            }
        }
        return cache.get(kid);
    }
}
