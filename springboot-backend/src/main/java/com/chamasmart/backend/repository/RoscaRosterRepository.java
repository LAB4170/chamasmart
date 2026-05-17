package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.RoscaRoster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoscaRosterRepository extends JpaRepository<RoscaRoster, Long> {

    @Query("SELECT rr FROM RoscaRoster rr JOIN FETCH rr.user WHERE rr.cycle.cycleId = :cycleId ORDER BY rr.position ASC")
    List<RoscaRoster> findByCycleCycleIdOrderByPositionAsc(@Param("cycleId") Long cycleId);

    Optional<RoscaRoster> findByCycleCycleIdAndUserUserId(Long cycleId, Long userId);

    Optional<RoscaRoster> findByCycleCycleIdAndPosition(Long cycleId, Integer position);
}
