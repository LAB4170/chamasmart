package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.AscaCycle;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AscaCycleRepository extends JpaRepository<AscaCycle, Long> {

    @Query("SELECT ac FROM AscaCycle ac JOIN FETCH ac.chama WHERE ac.chama.chamaId = :chamaId ORDER BY ac.startDate DESC")
    List<AscaCycle> findByChamaChamaId(@Param("chamaId") Long chamaId);

    List<AscaCycle> findByStatus(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT ac FROM AscaCycle ac WHERE ac.cycleId = :cycleId")
    Optional<AscaCycle> findByIdWithPessimisticLock(@Param("cycleId") Long cycleId);
}
