package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;

/** The header of a balanced posting. Rows are never updated or deleted; the database refuses it. */
@Entity
@Table(name = "journal_entries")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JournalEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "entry_id")
    private Long entryId;

    @Column(name = "chama_id", nullable = false, updatable = false)
    private Long chamaId;

    @Column(name = "posted_at", nullable = false, updatable = false)
    private ZonedDateTime postedAt;

    @Column(name = "entry_type", nullable = false, length = 40, updatable = false)
    private String entryType;

    @Column(name = "reference_type", length = 40, updatable = false)
    private String referenceType;

    @Column(name = "reference_id", updatable = false)
    private Long referenceId;

    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(length = 300, updatable = false)
    private String memo;

    /** The single-entry ledger row this was created from, when it was mirrored or back-filled. Unique, so nothing is posted twice. */
    @Column(name = "legacy_entry_id", updatable = false)
    private Long legacyEntryId;

    @Column(name = "reverses_entry_id", updatable = false)
    private Long reversesEntryId;

    @Column(name = "prev_hash", nullable = false, length = 64, updatable = false)
    private String prevHash;

    @Column(name = "entry_hash", nullable = false, length = 64, updatable = false)
    private String entryHash;
}
