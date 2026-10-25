package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.PortfolioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** The chamas the signed-in person runs, together. Only chamas where they are an official appear. */
@RestController
@RequestMapping("/portfolio")
@RequiredArgsConstructor
public class PortfolioController {
    private final PortfolioService portfolio;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> page(@RequestParam(required = false) String q, @RequestParam(defaultValue = "false") boolean attention,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(portfolio.page(me.getUserId(), q, attention, page, size), "Portfolio"));
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    public ResponseEntity<String> export(@AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=portfolio.csv").body(portfolio.csv(me.getUserId()));
    }
}
