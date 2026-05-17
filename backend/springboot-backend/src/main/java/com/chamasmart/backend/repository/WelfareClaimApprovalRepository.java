package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.WelfareClaimApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WelfareClaimApprovalRepository extends JpaRepository<WelfareClaimApproval, Long> {
    List<WelfareClaimApproval> findByClaimClaimId(Long claimId);
    Optional<WelfareClaimApproval> findByClaimClaimIdAndApproverUserId(Long claimId, Long approverId);
}
