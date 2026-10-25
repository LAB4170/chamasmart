package com.chamasmart.backend.controller;

import com.chamasmart.backend.service.PaymentEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Provider webhooks. Open to the internet by necessity; every request is authenticated by its signature, not by a login. */
@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentWebhookController {
    private final PaymentEventService events;

    @PostMapping("/paystack/webhook")
    public ResponseEntity<String> paystack(@RequestBody String raw, @RequestHeader(value = "x-paystack-signature", required = false) String signature) {
        PaymentEventService.Result r = events.handlePaystack(raw, signature);
        return r == PaymentEventService.Result.REJECTED ? ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("rejected") : ResponseEntity.ok("ok");
    }
}
