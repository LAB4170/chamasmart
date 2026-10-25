package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.PayoutApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayoutApprovalRepository extends JpaRepository<PayoutApproval, Long> {
    List<PayoutApproval> findByPayoutId(Long payoutId);
    boolean existsByPayoutIdAndApproverId(Long payoutId, Long approverId);
}
