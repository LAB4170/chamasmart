package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.RoscaCycle;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoscaCycleRepository extends JpaRepository<RoscaCycle, Long> {

    @Query("SELECT rc FROM RoscaCycle rc JOIN FETCH rc.chama WHERE rc.chama.chamaId = :chamaId ORDER BY rc.startDate DESC")
    List<RoscaCycle> findByChamaChamaId(@Param("chamaId") Long chamaId);

    List<RoscaCycle> findByStatus(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT rc FROM RoscaCycle rc WHERE rc.cycleId = :cycleId")
    Optional<RoscaCycle> findByIdWithPessimisticLock(@Param("cycleId") Long cycleId);
}
