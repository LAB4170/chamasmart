package com.chamasmart.backend.repository;
import com.chamasmart.backend.domain.Contribution;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
@Repository
public interface ContributionRepository extends JpaRepository<Contribution, Long> {
    @Query("SELECT c FROM Contribution c JOIN FETCH c.user WHERE c.chama.chamaId = :chamaId AND c.isDeleted = false ORDER BY c.contributionDate DESC")
    List<Contribution> findByChamaChamaIdAndIsDeletedFalse(@Param("chamaId") Long chamaId);
    @Query("SELECT c FROM Contribution c JOIN FETCH c.chama WHERE c.user.userId = :userId AND c.isDeleted = false ORDER BY c.contributionDate DESC")
    List<Contribution> findByUserUserIdAndIsDeletedFalse(@Param("userId") Long userId);
    /** One page of a chama's ledger. Sentinels stand in for "no filter" because Postgres cannot type a bare null parameter. */
    @Query(value = "SELECT c FROM Contribution c JOIN FETCH c.user WHERE c.chama.chamaId = :chamaId AND c.isDeleted = false "
            + "AND (:official = true OR UPPER(c.status) = 'COMPLETED' OR c.user.userId = :actorId) "
            + "AND c.contributionDate >= :from AND c.contributionDate < :to "
            + "AND (:userId = -1 OR c.user.userId = :userId) AND (:status = '' OR UPPER(c.status) = :status) "
            + "ORDER BY c.contributionDate DESC, c.contributionId DESC",
            countQuery = "SELECT COUNT(c) FROM Contribution c WHERE c.chama.chamaId = :chamaId AND c.isDeleted = false "
            + "AND (:official = true OR UPPER(c.status) = 'COMPLETED' OR c.user.userId = :actorId) "
            + "AND c.contributionDate >= :from AND c.contributionDate < :to "
            + "AND (:userId = -1 OR c.user.userId = :userId) AND (:status = '' OR UPPER(c.status) = :status)")
    org.springframework.data.domain.Page<Contribution> page(@Param("chamaId") Long chamaId, @Param("official") boolean official, @Param("actorId") Long actorId,
            @Param("from") java.time.ZonedDateTime from, @Param("to") java.time.ZonedDateTime to, @Param("userId") Long userId, @Param("status") String status,
            org.springframework.data.domain.Pageable pageable);

    /** Total of completed contributions that match the same filters, so the ledger header stays right on every page. */
    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM Contribution c WHERE c.chama.chamaId = :chamaId AND c.isDeleted = false AND UPPER(c.status) = 'COMPLETED' "
            + "AND (:official = true OR c.user.userId = :actorId OR UPPER(c.status) = 'COMPLETED') "
            + "AND c.contributionDate >= :from AND c.contributionDate < :to AND (:userId = -1 OR c.user.userId = :userId)")
    java.math.BigDecimal completedTotal(@Param("chamaId") Long chamaId, @Param("official") boolean official, @Param("actorId") Long actorId,
            @Param("from") java.time.ZonedDateTime from, @Param("to") java.time.ZonedDateTime to, @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Contribution c WHERE c.contributionId = :id")
    Optional<Contribution> findByIdWithPessimisticLock(@Param("id") Long id);
    /** Contributions of one chama whose reference is any of the given upper-case codes. */
    @Query("SELECT c FROM Contribution c WHERE c.chama.chamaId = :chamaId AND c.isDeleted = false AND UPPER(c.reference) IN :refs")
    List<Contribution> findByReferences(@Param("chamaId") Long chamaId, @Param("refs") java.util.Collection<String> refs);
    boolean existsByReference(String reference);
    boolean existsByReferenceIgnoreCase(String reference);
}
