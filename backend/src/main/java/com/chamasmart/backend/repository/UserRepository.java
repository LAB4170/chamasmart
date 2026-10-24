package com.chamasmart.backend.repository;
import com.chamasmart.backend.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    /** Case-insensitive: accounts created before emails were normalised may be stored in mixed case. */
    Optional<User> findFirstByEmailIgnoreCaseOrderByUserIdAsc(String email);
    default Optional<User> findByEmail(String email) {
        return email == null ? Optional.empty() : findFirstByEmailIgnoreCaseOrderByUserIdAsc(email.trim());
    }
    Optional<User> findByPhoneNumber(String phoneNumber);
    boolean existsByEmail(String email);
    boolean existsByPhoneNumber(String phoneNumber);
}

