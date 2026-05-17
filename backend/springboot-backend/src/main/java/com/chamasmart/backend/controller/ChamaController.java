package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.dto.ChamaSummaryDto;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.ChamaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/chamas")
@RequiredArgsConstructor
public class ChamaController {

    private final ChamaService chamaService;

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<ChamaSummaryDto>>> getMyChamas(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get chamas for current user ID: {}", currentUser.getUserId());
        List<ChamaSummaryDto> chamas = chamaService.getMyChamas(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(chamas, "Chamas retrieved successfully"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ChamaSummaryDto>> getChamaById(@PathVariable Long id) {
        log.info("REST request to get chama details for ID: {}", id);
        ChamaSummaryDto chama = chamaService.getChamaById(id);
        return ResponseEntity.ok(ApiResponse.success(chama, "Chama details retrieved successfully"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ChamaSummaryDto>> createChama(@RequestBody ChamaSummaryDto chamaDto,
                                                                    @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create chama by user ID: {}", currentUser.getUserId());
        ChamaSummaryDto createdChama = chamaService.createChama(chamaDto, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdChama, "Chama created successfully"));
    }
}
