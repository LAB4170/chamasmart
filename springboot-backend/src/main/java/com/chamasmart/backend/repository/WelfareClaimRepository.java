package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.WelfareClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WelfareClaimRepository extends JpaRepository<WelfareClaim, Long> {

    @Query("SELECT wc FROM WelfareClaim wc JOIN FETCH wc.chama JOIN FETCH wc.member JOIN FETCH wc.eventType WHERE wc.chama.chamaId = :chamaId ORDER BY wc.createdAt DESC")
    List<WelfareClaim> findByChamaChamaIdOrderByCreatedAtDesc(@Param("chamaId") Long chamaId);

    @Query("SELECT wc FROM WelfareClaim wc JOIN FETCH wc.chama JOIN FETCH wc.member JOIN FETCH wc.eventType WHERE wc.member.userId = :memberId ORDER BY wc.createdAt DESC")
    List<WelfareClaim> findByMemberUserId(@Param("memberId") Long memberId);
}
