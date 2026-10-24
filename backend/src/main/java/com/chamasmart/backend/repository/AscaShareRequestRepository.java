package com.chamasmart.backend.repository;
import com.chamasmart.backend.domain.AscaShareRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AscaShareRequestRepository extends JpaRepository<AscaShareRequest, Long> {
    @Query("SELECT r FROM AscaShareRequest r JOIN FETCH r.user WHERE r.cycle.cycleId = :cycleId ORDER BY r.createdAt ASC")
    List<AscaShareRequest> findByCycleId(@Param("cycleId") Long cycleId);
}
