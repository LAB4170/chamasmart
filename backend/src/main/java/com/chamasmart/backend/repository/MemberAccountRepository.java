package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.MemberAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MemberAccountRepository extends JpaRepository<MemberAccount, String> {
    Optional<MemberAccount> findByChamaIdAndUserId(Long chamaId, Long userId);
}
