package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.RoscaSwap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoscaSwapRepository extends JpaRepository<RoscaSwap, Long> {
    List<RoscaSwap> findByCycleCycleIdAndStatus(Long cycleId, String status);
    List<RoscaSwap> findByRequesterUserIdOrTargetUserIdOrderByCreatedAtDesc(Long requesterId, Long targetId);
}
