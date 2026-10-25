package com.chamasmart.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * What the platform does when a chama is suspected of misusing members' money. ChamaSmart does not hold chama money, so it cannot seize any.
 * What it can do is stop its own services, keep the records, and hand them to the people who can act: the chama's members, the courts and the police.
 *
 * Level 1  Warning: the officials are told what was found and given time to answer.
 * Level 2  Listing suspended: the chama leaves the public listing and cannot take new members from it.
 * Level 3  Activity frozen: no new payouts can be requested or approved through the platform.
 * Level 4  Terminated and referred: the account is closed to new activity and the records are prepared for the authorities.
 *
 * A level above 1 needs either an earlier case that has run its response window, or an urgent flag with the reason written down.
 * Every step is recorded, shown to the chama, and open to an answer from the chairperson.
 */
@Service
@RequiredArgsConstructor
public class EnforcementService {
    public static final Map<Integer, String> LEVELS = Map.of(1, "WARNING", 2, "LISTING_SUSPENDED", 3, "ACTIVITY_FROZEN", 4, "TERMINATED_AND_REFERRED");

    private final JdbcTemplate jdbc;
    private final MembershipService membership;
    private final VerificationService verification;
    private final AdminGuard audit;

    @Value("${app.enforcement.response-days:7}") int responseDays = 7;

    @Transactional
    public Map<String, Object> open(Long adminId, Long chamaId, int level, String reason, boolean urgent) {
        if (!LEVELS.containsKey(level)) throw new IllegalArgumentException("Level must be 1 (warning) to 4 (terminated and referred)");
        if (reason == null || reason.trim().length() < (level == 4 ? 100 : 20)) throw new IllegalArgumentException(level == 4
                ? "A level 4 case needs a full written account of the evidence (at least 100 characters)" : "Write down what was found (at least 20 characters)");
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM chamas WHERE chama_id = ?", Integer.class, chamaId);
        if (exists == null || exists == 0) throw new IllegalArgumentException("Chama not found");
        if (level > 1 && !urgent) {
            Integer ripe = jdbc.queryForObject("SELECT count(*) FROM enforcement_cases WHERE chama_id = ? AND status IN ('OPEN','RESOLVED') AND opened_at <= now() - (? * interval '1 day')", Integer.class, chamaId, responseDays);
            if (ripe == null || ripe == 0) throw new IllegalStateException("The chama must first be warned and given " + responseDays + " days to respond. If members' money is at immediate risk, mark the case urgent and say why");
        }
        boolean propose = level >= 3 && audit.twoPerson();
        Long id = jdbc.queryForObject("INSERT INTO enforcement_cases (chama_id, level, urgent, reason, opened_by, status) VALUES (?,?,?,?,?,?) RETURNING case_id",
                Long.class, chamaId, level, urgent, reason.trim(), adminId, propose ? "PROPOSED" : "OPEN");
        if (propose) {
            audit.log(adminId, "CASE_PROPOSED_L" + level, chamaId, "case " + id + (urgent ? " [urgent] " : " ") + reason);
            return get(id);
        }
        takeEffect(chamaId, level, reason.trim());
        audit.log(adminId, "CASE_OPENED_L" + level, chamaId, "case " + id + (audit.twoPerson() || level < 3 ? " " : " [single operator] ") + (urgent ? "[urgent] " : "") + reason);
        return get(id);
    }

    private void takeEffect(Long chamaId, int level, String reason) {
        if (level >= 2) verification.suspendListing(chamaId);
        verification.tell(chamaId, "Notice from ChamaSmart: " + LEVELS.get(level).replace('_', ' ').toLowerCase(),
                reason + " You can answer this notice in your chama's page. You have the right to respond and to ask for a review.");
    }

    /** A second person confirms a proposed level 3 or 4 notice. Only then does it take effect and does the chama hear of it. */
    @Transactional
    public Map<String, Object> confirm(Long adminId, Long caseId) {
        var c = jdbc.queryForList("SELECT chama_id, level, reason, opened_by, status FROM enforcement_cases WHERE case_id = ? FOR UPDATE", caseId);
        if (c.isEmpty()) throw new IllegalArgumentException("Case not found");
        Map<String, Object> r = c.get(0);
        if (!"PROPOSED".equals(r.get("status"))) throw new IllegalStateException("This case is not waiting for confirmation");
        if (adminId.equals(((Number) r.get("opened_by")).longValue())) throw new IllegalStateException("A different person must confirm this notice");
        Long chamaId = ((Number) r.get("chama_id")).longValue(); int level = ((Number) r.get("level")).intValue();
        jdbc.update("UPDATE enforcement_cases SET status = 'OPEN', confirmed_by = ?, confirmed_at = now(), opened_at = now() WHERE case_id = ?", adminId, caseId);
        takeEffect(chamaId, level, (String) r.get("reason"));
        audit.log(adminId, "CASE_CONFIRMED_L" + level, chamaId, "case " + caseId);
        return get(caseId);
    }

    @Transactional
    public Map<String, Object> cancelProposal(Long adminId, Long caseId, String note) {
        if (note == null || note.trim().length() < 5) throw new IllegalArgumentException("Say why you are withdrawing it");
        var c = jdbc.queryForList("SELECT chama_id, status FROM enforcement_cases WHERE case_id = ? FOR UPDATE", caseId);
        if (c.isEmpty()) throw new IllegalArgumentException("Case not found");
        if (!"PROPOSED".equals(c.get(0).get("status"))) throw new IllegalStateException("This case is not waiting for confirmation");
        jdbc.update("UPDATE enforcement_cases SET status = 'CANCELLED', resolved_by = ?, resolved_at = now(), resolution_note = ? WHERE case_id = ?", adminId, note.trim(), caseId);
        audit.log(adminId, "CASE_PROPOSAL_WITHDRAWN", ((Number) c.get(0).get("chama_id")).longValue(), "case " + caseId + ": " + note.trim());
        return get(caseId);
    }

    /** The chairperson (or another official) answers a notice. */
    @Transactional
    public Map<String, Object> respond(Long chamaId, Long userId, Long caseId, String text) {
        membership.activeOfficial(chamaId, userId);
        if (text == null || text.trim().length() < 10) throw new IllegalArgumentException("Write your response (at least a sentence)");
        int n = jdbc.update("UPDATE enforcement_cases SET response_text = ?, responded_by = ?, responded_at = now() WHERE case_id = ? AND chama_id = ? AND status = 'OPEN'",
                text.trim().length() > 2000 ? text.trim().substring(0, 2000) : text.trim(), userId, caseId, chamaId);
        if (n == 0) throw new IllegalArgumentException("No open case with that number for this chama");
        audit.log(userId, "CASE_RESPONSE", chamaId, "case " + caseId);
        return get(caseId);
    }

    @Transactional
    public Map<String, Object> resolve(Long adminId, Long caseId, String note) {
        if (note == null || note.trim().length() < 10) throw new IllegalArgumentException("Record the outcome and why");
        var c = jdbc.queryForList("SELECT chama_id, status FROM enforcement_cases WHERE case_id = ? FOR UPDATE", caseId);
        if (c.isEmpty()) throw new IllegalArgumentException("Case not found");
        if (!"OPEN".equals(c.get(0).get("status"))) throw new IllegalStateException("This case is already closed");
        Long chamaId = ((Number) c.get(0).get("chama_id")).longValue();
        jdbc.update("UPDATE enforcement_cases SET status = 'RESOLVED', resolved_by = ?, resolved_at = now(), resolution_note = ? WHERE case_id = ?", adminId, note.trim(), caseId);
        verification.tell(chamaId, "Notice from ChamaSmart: case closed", note.trim());
        audit.log(adminId, "CASE_RESOLVED", chamaId, "case " + caseId + ": " + note);
        return get(caseId);
    }

    /** Level 3 and 4 stop new payouts through the platform. */
    public boolean frozen(Long chamaId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM enforcement_cases WHERE chama_id = ? AND status = 'OPEN' AND level >= 3", Integer.class, chamaId);
        return n != null && n > 0;
    }

    public List<Map<String, Object>> forChama(Long chamaId, Long userId) {
        membership.activeOfficial(chamaId, userId);
        return jdbc.queryForList("SELECT case_id, level, status, urgent, reason, opened_at, response_text, responded_at, resolved_at, resolution_note FROM enforcement_cases WHERE chama_id = ? AND status IN ('OPEN','RESOLVED') ORDER BY opened_at DESC", chamaId);
    }

    public List<Map<String, Object>> openCases() {
        return jdbc.queryForList("""
                SELECT e.case_id, e.chama_id, c.chama_name, e.level, e.status, e.urgent, e.reason, e.opened_by, e.opened_at, e.response_text IS NOT NULL AS responded
                FROM enforcement_cases e JOIN chamas c ON c.chama_id = e.chama_id WHERE e.status IN ('OPEN','PROPOSED') ORDER BY e.status DESC, e.level DESC, e.opened_at""");
    }

    public Map<String, Object> get(Long caseId) {
        var r = jdbc.queryForList("SELECT * FROM enforcement_cases WHERE case_id = ?", caseId);
        if (r.isEmpty()) throw new IllegalArgumentException("Case not found");
        return r.get(0);
    }
}
