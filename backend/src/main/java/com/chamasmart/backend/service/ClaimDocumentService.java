package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import com.chamasmart.backend.util.UploadCheck;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.util.*;

/** Proof files for welfare claims: the claimant adds them while the claim is open; the claimant and officials can read them. */
@Service
@RequiredArgsConstructor
public class ClaimDocumentService {
    static final int MAX_FILES = 3;

    private final ClaimDocumentRepository documents;
    private final WelfareClaimRepository claims;
    private final ChamaMemberRepository members;
    private final FinancialAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    private WelfareClaim claim(Long claimId) {
        return claims.findById(claimId).orElseThrow(() -> new IllegalArgumentException("Claim not found"));
    }

    private void requireReader(WelfareClaim c, Long userId) {
        ChamaMember m = members.findByChamaChamaIdAndUserUserId(c.getChama().getChamaId(), userId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not a member of this chama"));
        boolean owner = c.getMember().getUserId().equals(userId);
        if (!owner && !MembershipService.isOfficial(m)) throw new AccessDeniedException("Only the claimant and officials can see proof documents");
    }

    @Transactional
    public Map<String, Object> add(Long claimId, Long userId, String originalName, byte[] bytes) {
        WelfareClaim c = claim(claimId);
        if (!c.getMember().getUserId().equals(userId)) throw new AccessDeniedException("Only the person who filed the claim can attach proof");
        if (!List.of("SUBMITTED", "VERIFIED").contains(c.getStatus())) throw new IllegalStateException("This claim is closed, so proof can no longer be added");
        String type = UploadCheck.detect(bytes);
        if (documents.countByClaimClaimId(claimId) >= MAX_FILES) throw new IllegalStateException("A claim can hold up to " + MAX_FILES + " proof files");
        ClaimDocument d = documents.save(ClaimDocument.builder().claim(c).fileName(UploadCheck.safeName(originalName, type)).contentType(type)
                .sizeBytes(bytes.length).uploadedBy(userId).sha256(sha256(bytes)).data(bytes).build());
        auditLogRepository.save(FinancialAuditLog.builder().user(userRepository.getReferenceById(userId)).transactionType("WELFARE_PROOF_ADDED")
                .chama(c.getChama()).referenceId(claimId).description("Proof file " + d.getFileName() + " (" + d.getSizeBytes() + " bytes)").build());
        return Map.of("document_id", d.getDocumentId(), "file_name", d.getFileName(), "content_type", type, "size_bytes", d.getSizeBytes());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(Long claimId, Long userId) {
        requireReader(claim(claimId), userId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (ClaimDocumentRepository.Meta m : documents.findByClaimClaimIdOrderByCreatedAtAsc(claimId)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("document_id", m.getDocumentId()); row.put("file_name", m.getFileName());
            row.put("content_type", m.getContentType()); row.put("size_bytes", m.getSizeBytes()); row.put("created_at", m.getCreatedAt());
            out.add(row);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public ClaimDocument get(Long claimId, Long documentId, Long userId) {
        requireReader(claim(claimId), userId);
        return documents.findById(documentId).filter(d -> d.getClaim().getClaimId().equals(claimId))
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    private static String sha256(byte[] b) {
        try {
            StringBuilder sb = new StringBuilder();
            for (byte x : MessageDigest.getInstance("SHA-256").digest(b)) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Exception e) { return null; }
    }
}
