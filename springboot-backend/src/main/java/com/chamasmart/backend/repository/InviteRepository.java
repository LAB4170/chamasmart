package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Invite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InviteRepository extends JpaRepository<Invite, Long> {

    @Query("SELECT i FROM Invite i JOIN FETCH i.chama JOIN FETCH i.invitedBy WHERE i.inviteCode = :inviteCode")
    Optional<Invite> findByInviteCode(@Param("inviteCode") String inviteCode);

    @Query("SELECT i FROM Invite i JOIN FETCH i.chama JOIN FETCH i.invitedBy WHERE i.chama.chamaId = :chamaId AND i.status = :status")
    List<Invite> findByChamaChamaIdAndStatus(@Param("chamaId") Long chamaId, @Param("status") String status);
}
