package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Chama;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChamaRepository extends JpaRepository<Chama, Long> {
    List<Chama> findByIsActiveTrue();
    List<Chama> findByCreatedByUserIdAndIsActiveTrue(Long userId);
    List<Chama> findByVisibilityAndIsActiveTrue(String visibility);
}
