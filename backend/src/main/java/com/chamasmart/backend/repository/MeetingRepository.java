package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Meeting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeetingRepository extends JpaRepository<Meeting, Long> {

    @Query("SELECT m FROM Meeting m JOIN FETCH m.chama JOIN FETCH m.createdBy WHERE m.chama.chamaId = :chamaId ORDER BY m.scheduledDate DESC")
    List<Meeting> findByChamaChamaIdOrderByScheduledDateDesc(@Param("chamaId") Long chamaId);
}
