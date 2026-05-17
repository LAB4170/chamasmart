package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Chama;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChamaRepository extends JpaRepository<Chama, Long> {
    List<Chama> findByIsActiveTrue();
    List<Chama> findByCreatedByUserIdAndIsActiveTrue(Long userId);
    List<Chama> findByVisibilityAndIsActiveTrue(String visibility);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Chama c WHERE c.chamaId = :chamaId")
    Optional<Chama> findByIdWithPessimisticLock(@Param("chamaId") Long chamaId);
}
