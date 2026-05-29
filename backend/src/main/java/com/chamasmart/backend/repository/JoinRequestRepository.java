package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.JoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JoinRequestRepository extends JpaRepository<JoinRequest, Long> {

    @Query("SELECT jr FROM JoinRequest jr JOIN FETCH jr.chama JOIN FETCH jr.user WHERE jr.chama.chamaId = :chamaId AND jr.status = :status ORDER BY jr.createdAt DESC")
    List<JoinRequest> findByChamaChamaIdAndStatus(@Param("chamaId") Long chamaId, @Param("status") String status);

    @Query("SELECT jr FROM JoinRequest jr JOIN FETCH jr.chama JOIN FETCH jr.user WHERE jr.chama.chamaId = :chamaId AND jr.user.userId = :userId")
    Optional<JoinRequest> findByChamaChamaIdAndUserUserId(@Param("chamaId") Long chamaId, @Param("userId") Long userId);
}
