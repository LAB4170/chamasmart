package com.chamasmart.backend.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

class FirebaseTokenVerifierTest {
    static KeyPair good, other;
    static final String PROJECT = "demo-project";
    FirebaseTokenVerifier verifier = new FirebaseTokenVerifier(PROJECT, kid -> "k1".equals(kid) ? good.getPublic() : null);

    @BeforeAll
    static void keys() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048);
        good = g.generateKeyPair();
        other = g.generateKeyPair();
    }

    private String token(KeyPair signer, String kid, String iss, String aud, long expiresInMs, boolean emailVerified) {
        return Jwts.builder().header().keyId(kid).and()
                .issuer(iss).audience().add(aud).and().subject("uid1")
                .claim("email", "Person@Example.com").claim("email_verified", emailVerified)
                .issuedAt(new Date()).expiration(new Date(System.currentTimeMillis() + expiresInMs))
                .signWith(signer.getPrivate(), Jwts.SIG.RS256).compact();
    }

    @Test void validTokenGivesTheVerifiedIdentity() {
        var id = verifier.verify(token(good, "k1", "https://securetoken.google.com/" + PROJECT, PROJECT, 60_000, true));
        assertEquals("person@example.com", id.email());
        assertTrue(id.emailVerified());
    }

    @Test void tokenSignedByAnotherKeyIsRejected() {
        assertThrows(SecurityException.class, () -> verifier.verify(token(other, "k1", "https://securetoken.google.com/" + PROJECT, PROJECT, 60_000, true)));
    }

    @Test void unknownKeyIdIsRejected() {
        assertThrows(SecurityException.class, () -> verifier.verify(token(good, "nope", "https://securetoken.google.com/" + PROJECT, PROJECT, 60_000, true)));
    }

    @Test void wrongProjectIsRejected() {
        assertThrows(SecurityException.class, () -> verifier.verify(token(good, "k1", "https://securetoken.google.com/evil", "evil", 60_000, true)));
    }

    @Test void expiredTokenIsRejected() {
        assertThrows(SecurityException.class, () -> verifier.verify(token(good, "k1", "https://securetoken.google.com/" + PROJECT, PROJECT, -60_000, true)));
    }

    @Test void unsignedTokenIsRejected() {
        String unsigned = Jwts.builder().subject("uid1").claim("email", "a@b.co").issuer("https://securetoken.google.com/" + PROJECT).audience().add(PROJECT).and().compact();
        assertThrows(SecurityException.class, () -> verifier.verify(unsigned));
    }

    @Test void garbageAndBlankAreRejected() {
        assertThrows(SecurityException.class, () -> verifier.verify("not-a-token"));
        assertThrows(SecurityException.class, () -> verifier.verify(" "));
        assertThrows(SecurityException.class, () -> verifier.verify(null));
    }
}
