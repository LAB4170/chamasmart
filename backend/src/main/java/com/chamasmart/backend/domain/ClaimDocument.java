package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.ZonedDateTime;

/** A proof file attached to a welfare claim. Kept in the database so it survives redeploys; served only to the claimant and officials. */
@Entity
@Table(name = "welfare_claim_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClaimDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "document_id")
    private Long documentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "claim_id", nullable = false)
    private WelfareClaim claim;

    @Column(name = "file_name", nullable = false, length = 100)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 50)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private Integer sizeBytes;

    @Column(name = "uploaded_by", nullable = false)
    private Long uploadedBy;

    @Column(name = "sha256", length = 64)
    private String sha256;

    @Column(nullable = false)
    private byte[] data;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}
