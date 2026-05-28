package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import com.chamasmart.backend.service.TrustScoreService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


@RestController
@RequestMapping("/trust")
@RequiredArgsConstructor
public class TrustScoreController {
    private static final Logger log = LoggerFactory.getLogger(TrustScoreController.class);

    private final TrustScoreService trustScoreService;
    private final ChamaMemberRepository memberRepo;

    @GetMapping("/member/{memberId}")
    public ResponseEntity<ApiResponse<Integer>> getMemberScore(@PathVariable Long memberId) {
        log.info("REST request to get trust score for member ID: {}", memberId);
        ChamaMember member = memberRepo.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found"));
                
        // Re-compute on every call
        int score = trustScoreService.recomputeTrustScore(member);
        
        return ResponseEntity.ok(ApiResponse.success(score, "Trust score retrieved successfully"));
    }
}


