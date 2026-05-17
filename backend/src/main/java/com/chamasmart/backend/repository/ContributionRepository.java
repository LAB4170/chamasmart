package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Contribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContributionRepository extends JpaRepository<Contribution, Long> {

    @Query("SELECT c FROM Contribution c JOIN FETCH c.user WHERE c.chama.chamaId = :chamaId AND c.isDeleted = false ORDER BY c.contributionDate DESC")
    List<Contribution> findByChamaChamaIdAndIsDeletedFalse(@Param("chamaId") Long chamaId);

    @Query("SELECT c FROM Contribution c JOIN FETCH c.chama WHERE c.user.userId = :userId AND c.isDeleted = false ORDER BY c.contributionDate DESC")
    List<Contribution> findByUserUserIdAndIsDeletedFalse(@Param("userId") Long userId);
}
