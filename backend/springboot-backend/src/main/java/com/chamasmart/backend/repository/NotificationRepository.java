package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @Query("SELECT n FROM Notification n JOIN FETCH n.user WHERE n.user.userId = :userId ORDER BY n.createdAt DESC")
    List<Notification> findByUserUserIdOrderByCreatedAtDesc(@Param("userId") Long userId);

    @Query("SELECT n FROM Notification n JOIN FETCH n.user WHERE n.user.userId = :userId AND n.isRead = false ORDER BY n.createdAt DESC")
    List<Notification> findByUserUserIdAndIsReadFalse(@Param("userId") Long userId);
}
