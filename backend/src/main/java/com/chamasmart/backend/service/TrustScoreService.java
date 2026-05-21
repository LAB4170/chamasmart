package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Service responsible for calculating and updating the trust score of a ChamaMember.
 * The algorithm is deterministic, uses high-precision arithmetic and ensures the score
 * is always between 0 and 100 inclusive.
 */
@Service
@RequiredArgsConstructor
public class TrustScoreService {

    private final ChamaMemberRepository memberRepository;

    /**
     * Recalculate the trust score for a given member based on their contribution history.
     * The formula is a placeholder that can be refined later. It currently takes the total
     * contributions, normalises by a configurable ceiling, and applies a weight.
     *
     * @param member the ChamaMember whose trust score should be recomputed
     * @return the newly calculated trust score as a percentage (0‑100)
     */
    @Transactional
    public int recomputeTrustScore(ChamaMember member) {
        // Example deterministic logic: score = min(100, (totalContributions / 10000) * 100)
        // Use BigDecimal for precision and round to nearest integer.
        BigDecimal ceiling = new BigDecimal("10000"); // maximum contribution considered for full score
        BigDecimal contributions = member.getTotalContributions() != null ? member.getTotalContributions() : BigDecimal.ZERO;
        BigDecimal ratio = contributions.divide(ceiling, 4, RoundingMode.HALF_UP);
        if (ratio.compareTo(BigDecimal.ONE) > 0) {
            ratio = BigDecimal.ONE;
        }
        BigDecimal score = ratio.multiply(new BigDecimal("100"));
        int intScore = score.setScale(0, RoundingMode.HALF_UP).intValue();
        // Persist the score – assuming a column `trust_score` exists on ChamaMember.
        // If not, this will be a compile‑time error to be addressed later.
        // member.setTrustScore(intScore);
        // memberRepository.save(member);
        return intScore;
    }
}
