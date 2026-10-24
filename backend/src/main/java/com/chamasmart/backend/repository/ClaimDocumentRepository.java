package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.ClaimDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.List;

@Repository
public interface ClaimDocumentRepository extends JpaRepository<ClaimDocument, Long> {
    /** Listing never loads the file bytes. */
    interface Meta {
        Long getDocumentId();
        String getFileName();
        String getContentType();
        Integer getSizeBytes();
        ZonedDateTime getCreatedAt();
    }

    List<Meta> findByClaimClaimIdOrderByCreatedAtAsc(Long claimId);

    long countByClaimClaimId(Long claimId);
}
