ckage com.chamasmart.backend.service;
import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.domain.Loan;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import com.chamasmart.backend.repository.LoanRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
/**
 * Service responsible for calculating and updating the trust score of a ChamaMember.
 */
@Service
@RequiredArgsConstructor
public class TrustScoreService {
    private final ChamaMemberRepository memberRepository;
    private final LoanRepository loanRepository;
    /**
     * Recalculate the trust score for a given member based on their contribution history,
     * loan repayment, and account age.
     *
     * @param member the ChamaMember whose trust score should be recomputed
     * @return the newly calculated trust score as a percentage (0â€‘100)
     */
    @Transactional
    public int recomputeTrustScore(ChamaMember member) {
        // 1. Total contributions (Max 30 points)
        BigDecimal total = member.getTotalContributions() != null ? member.getTotalContributions() : BigDecimal.ZERO;
        int contributionScore = total.compareTo(BigDecimal.valueOf(100_000)) >= 0 ? 30
                : total.compareTo(BigDecimal.valueOf(50_000)) >= 0 ? 20
                : total.compareTo(BigDecimal.valueOf(10_000)) >= 0 ? 10
                : 0;
        // 2. On-time loan payments (Max 25 points)
        // Check loans for this user in this specific chama
        List<Loan> userLoans = loanRepository.findByBorrowerUserId(member.getUser().getUserId()).stream()
                .filter(l -> l.getChama().getChamaId().equals(member.getChama().getChamaId()))
                .toList();
        int paymentScore = 0;
        int penalty = 0;
        if (!userLoans.isEmpty()) {
            long paidCount = userLoans.stream().filter(l -> "COMPLETED".equals(l.getStatus())).count();
            double onTimeRatio = (double) paidCount / userLoans.size();
            paymentScore = (int) Math.round(onTimeRatio * 25);
            // Negative flags: Any defaulted loans
            boolean hasDefaulted = userLoans.stream().anyMatch(l -> "DEFAULTED".equals(l.getStatus()));
            if (hasDefaulted) {
                penalty = -20;
            }
        } else {
            // If no loans, give a neutral starting score of 15 for this section
            paymentScore = 15;
        }
        // 3. Account age (Max 10 points)
        long months = ChronoUnit.MONTHS.between(member.getJoinDate() != null ? member.getJoinDate() : ZonedDateTime.now(), ZonedDateTime.now());
        int ageScore = (int) Math.min(10, months / 6); // +1 every 6 months up to 10 points
        // Calculate final score
        int rawScore = contributionScore + paymentScore + ageScore + penalty;
        // Ensure a minimum baseline score for new members without contributions or loans
        final int DEFAULT_MIN_SCORE = 50;
        if (rawScore < DEFAULT_MIN_SCORE && penalty == 0) {
            rawScore = DEFAULT_MIN_SCORE;
        }
        int finalScore = Math.max(0, Math.min(100, rawScore));
        // Persist the score
        member.setTrustScore(BigDecimal.valueOf(finalScore));
        memberRepository.save(member);
        return finalScore;
    }
}

