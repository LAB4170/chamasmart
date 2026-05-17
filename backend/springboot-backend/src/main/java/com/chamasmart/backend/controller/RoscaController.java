package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.dto.RoscaCycleDto;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.RoscaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/rosca")
@RequiredArgsConstructor
public class RoscaController {

    private final RoscaService roscaService;

    @PostMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<RoscaCycleDto>> createCycle(@PathVariable Long chamaId,
                                                                  @RequestBody RoscaCycleDto cycleDto,
                                                                  @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create ROSCA cycle for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        RoscaCycleDto createdCycle = roscaService.createCycle(cycleDto, chamaId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdCycle, "ROSCA cycle created successfully"));
    }

    @GetMapping("/chamas/{chamaId}/cycles")
    public ResponseEntity<ApiResponse<List<RoscaCycleDto>>> getCyclesByChamaId(@PathVariable Long chamaId) {
        log.info("REST request to get ROSCA cycles for chama ID: {}", chamaId);
        List<RoscaCycleDto> cycles = roscaService.getCyclesByChamaId(chamaId);
        return ResponseEntity.ok(ApiResponse.success(cycles, "ROSCA cycles retrieved successfully"));
    }
}
