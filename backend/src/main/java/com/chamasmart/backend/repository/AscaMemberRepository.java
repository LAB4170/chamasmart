package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.AscaMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AscaMemberRepository extends JpaRepository<AscaMember, Long> {

    @Query("SELECT am FROM AscaMember am JOIN FETCH am.user WHERE am.cycle.cycleId = :cycleId ORDER BY am.sharesOwned DESC")
    List<AscaMember> findByCycleCycleId(@Param("cycleId") Long cycleId);

    Optional<AscaMember> findByCycleCycleIdAndUserUserId(Long cycleId, Long userId);
}
