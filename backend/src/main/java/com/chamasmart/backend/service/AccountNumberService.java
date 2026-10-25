package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.ChamaAccountCode;
import com.chamasmart.backend.domain.MemberAccount;
import com.chamasmart.backend.ledger.AccountNumbers;
import com.chamasmart.backend.repository.ChamaAccountCodeRepository;
import com.chamasmart.backend.repository.MemberAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AccountNumberService {
    private final ChamaAccountCodeRepository codes;
    private final MemberAccountRepository accounts;
    private final SecureRandom rnd = new SecureRandom();

    /** The chama's code, created on first use. */
    @Transactional
    public ChamaAccountCode codeFor(Long chamaId) {
        return codes.findById(chamaId).orElseGet(() -> {
            String code;
            do { code = AccountNumbers.chamaCode(10000 + rnd.nextInt(90000)); } while (codes.existsByAccountCode(code));
            return codes.saveAndFlush(ChamaAccountCode.builder().chamaId(chamaId).accountCode(code).build());
        });
    }

    /** The member's account number in this chama, created on first use. The chama row is locked so numbers are handed out one at a time. */
    @Transactional
    public MemberAccount forMember(Long chamaId, Long userId) {
        Optional<MemberAccount> have = accounts.findByChamaIdAndUserId(chamaId, userId);
        if (have.isPresent()) return have.get();
        codeFor(chamaId);
        ChamaAccountCode c = codes.lockById(chamaId).orElseThrow();
        have = accounts.findByChamaIdAndUserId(chamaId, userId);
        if (have.isPresent()) return have.get();
        int seq = c.getNextSeq();
        if (seq > 9999) throw new IllegalStateException("This chama has used all its account numbers");
        c.setNextSeq(seq + 1);
        codes.save(c);
        return accounts.save(MemberAccount.builder().accountNumber(AccountNumbers.memberAccount(c.getAccountCode(), seq)).chamaId(chamaId).userId(userId).seq(seq).build());
    }

    public Optional<MemberAccount> lookup(String typed) {
        String n = AccountNumbers.normalise(typed);
        return AccountNumbers.valid(n) ? accounts.findById(n) : Optional.empty();
    }
}
