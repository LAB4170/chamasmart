package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.MemberFine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberFineRepository extends JpaRepository<MemberFine, Long> {
    List<MemberFine> findByChamaChamaIdOrderByCreatedAtDesc(Long chamaId);
    List<MemberFine> findByChamaChamaIdAndUserUserIdOrderByCreatedAtDesc(Long chamaId, Long userId);
    List<MemberFine> findByChamaChamaIdAndUserUserIdAndStatusOrderByCreatedAtAsc(Long chamaId, Long userId, String status);
    boolean existsBySourceAndCycleIdAndRoundNoAndUserUserId(String source, Long cycleId, Integer roundNo, Long userId);
}
