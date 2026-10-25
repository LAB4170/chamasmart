package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.ChamaSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChamaSubscriptionRepository extends JpaRepository<ChamaSubscription, Long> {
    Optional<ChamaSubscription> findFirstByChamaIdOrderBySubscriptionIdDesc(Long chamaId);
    List<ChamaSubscription> findByStatusInAndCurrentPeriodEndBefore(List<String> statuses, ZonedDateTime before);
}
