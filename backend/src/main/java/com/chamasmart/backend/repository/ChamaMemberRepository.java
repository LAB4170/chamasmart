package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.ChamaMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChamaMemberRepository extends JpaRepository<ChamaMember, Long> {
    
    @Query("SELECT cm FROM ChamaMember cm JOIN FETCH cm.chama c WHERE cm.user.userId = :userId AND cm.isActive = true AND c.isActive = true")
    List<ChamaMember> findActiveMembershipsByUserId(@Param("userId") Long userId);

    Optional<ChamaMember> findByChamaChamaIdAndUserUserId(Long chamaId, Long userId);
    
    List<ChamaMember> findByChamaChamaIdAndIsActiveTrue(Long chamaId);
    
    boolean existsByChamaChamaIdAndUserUserIdAndIsActiveTrue(Long chamaId, Long userId);
}
