package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.WelfareConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WelfareConfigRepository extends JpaRepository<WelfareConfig, Long> {

    @Query("SELECT wc FROM WelfareConfig wc JOIN FETCH wc.chama WHERE wc.chama.chamaId = :chamaId AND wc.isActive = true ORDER BY wc.eventType ASC")
    List<WelfareConfig> findByChamaChamaIdAndIsActiveTrue(@Param("chamaId") Long chamaId);

    Optional<WelfareConfig> findByChamaChamaIdAndEventType(Long chamaId, String eventType);
}
