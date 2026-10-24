package com.chamasmart.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.HttpInputMessage;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void unreadableBodiesAre400WithoutParserDetails() {
        var res = handler.handleUnreadable(new HttpMessageNotReadableException("Unexpected character ('b' (code 98))", (HttpInputMessage) null));
        assertEquals(HttpStatus.BAD_REQUEST, res.getStatusCode());
        assertFalse(res.getBody().getMessage().contains("Unexpected character"));
    }

    @Test
    void unexpectedCheckedFailuresAreGeneric500() throws Exception {
        var res = handler.handleUnexpected(new Exception("jdbc:postgresql://secret-host/db password=abc"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, res.getStatusCode());
        assertFalse(res.getBody().getMessage().contains("secret-host"));
    }
}
