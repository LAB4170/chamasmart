package com.chamasmart.backend.domain;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UserJsonTest {
    @Test void passwordHashIsNeverSerialised() throws Exception {
        User u = new User();
        u.setEmail("a@b.com");
        u.setPasswordHash("$2a$10$secret");
        String json = new ObjectMapper().writeValueAsString(u);
        assertFalse(json.contains("passwordHash"), json);
        assertFalse(json.contains("$2a$"), json);
        assertTrue(json.contains("a@b.com"));
    }
}
