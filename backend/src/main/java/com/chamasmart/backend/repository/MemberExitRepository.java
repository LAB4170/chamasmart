package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.MemberExit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberExitRepository extends JpaRepository<MemberExit, Long> {
    List<MemberExit> findByChamaChamaIdOrderByCreatedAtDesc(Long chamaId);
    List<MemberExit> findByChamaChamaIdAndUserUserIdAndStatusIn(Long chamaId, Long userId, java.util.Collection<String> statuses);
    List<MemberExit> findByUserUserIdOrderByCreatedAtDesc(Long userId);
}
