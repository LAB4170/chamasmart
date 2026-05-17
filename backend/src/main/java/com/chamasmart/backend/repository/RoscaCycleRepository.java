package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.RoscaCycle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoscaCycleRepository extends JpaRepository<RoscaCycle, Long> {

    @Query("SELECT rc FROM RoscaCycle rc JOIN FETCH rc.chama WHERE rc.chama.chamaId = :chamaId ORDER BY rc.startDate DESC")
    List<RoscaCycle> findByChamaChamaId(@Param("chamaId") Long chamaId);

    List<RoscaCycle> findByStatus(String status);
}
