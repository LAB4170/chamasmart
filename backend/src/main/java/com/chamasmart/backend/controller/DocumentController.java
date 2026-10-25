package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** Officials upload the documents behind a listing application. They can see what has been uploaded, never download it. */
@RestController
@RequiredArgsConstructor
public class DocumentController {
    private final DocumentService documents;

    @PostMapping(value = "/chamas/{chamaId}/documents", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(@PathVariable Long chamaId, @RequestParam("type") String type,
            @RequestParam(value = "subject_user_id", required = false) Long subject, @RequestParam("file") MultipartFile file, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(documents.upload(chamaId, me.getUserId(), type, subject, file), "Uploaded"));
    }

    @GetMapping("/chamas/{chamaId}/documents")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(documents.listForChama(chamaId, me.getUserId()), "Documents"));
    }
}
