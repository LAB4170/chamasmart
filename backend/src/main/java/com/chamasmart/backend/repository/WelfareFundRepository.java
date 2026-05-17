package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.WelfareFund;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WelfareFundRepository extends JpaRepository<WelfareFund, Long> {

    @Query("SELECT wf FROM WelfareFund wf JOIN FETCH wf.chama WHERE wf.chama.chamaId = :chamaId")
    Optional<WelfareFund> findByChamaChamaId(@Param("chamaId") Long chamaId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT wf FROM WelfareFund wf WHERE wf.chama.chamaId = :chamaId")
    Optional<WelfareFund> findByChamaIdWithPessimisticLock(@Param("chamaId") Long chamaId);
}
