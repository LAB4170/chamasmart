package com.chamasmart.backend.scheduler;

import com.chamasmart.backend.repository.ChamaMemberRepository;
import com.chamasmart.backend.service.TrustScoreService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TrustScoreScheduler {

    private final ChamaMemberRepository memberRepo;
    private final TrustScoreService trustScoreService;

    // Runs nightly at 02:00 AM
    @Scheduled(cron = "0 0 2 * * *")
    public void recomputeAllScores() {
        log.info("Starting nightly trust score recomputation batch job...");
        long count = 0;
        for (var member : memberRepo.findAll()) {
            if (member.getIsActive()) {
                trustScoreService.recomputeTrustScore(member);
                count++;
            }
        }
        log.info("Finished recomputing trust scores for {} active members", count);
    }
}
