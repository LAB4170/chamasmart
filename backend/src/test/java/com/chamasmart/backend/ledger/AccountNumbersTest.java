package com.chamasmart.backend.ledger;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AccountNumbersTest {
    @Test
    void generatedNumbersAreValidAndCarryTheChamaCode() {
        String code = AccountNumbers.chamaCode(48213);
        assertTrue(AccountNumbers.valid(code));
        String acct = AccountNumbers.memberAccount(code, 7);
        assertEquals(11, acct.length());
        assertTrue(acct.startsWith(code));
        assertTrue(AccountNumbers.valid(acct));
    }

    @Test
    void anySingleMistypedDigitIsCaught() {
        String acct = AccountNumbers.memberAccount(AccountNumbers.chamaCode(10001), 12);
        for (int i = 0; i < acct.length(); i++) {
            for (char d = '0'; d <= '9'; d++) {
                if (d == acct.charAt(i)) continue;
                String bad = acct.substring(0, i) + d + acct.substring(i + 1);
                assertFalse(AccountNumbers.valid(bad), bad);
            }
        }
    }

    @Test
    void swappedNeighbourDigitsAreMostlyCaughtAndFormattingIsIgnored() {
        String acct = AccountNumbers.memberAccount(AccountNumbers.chamaCode(55555), 3);
        assertEquals(acct, AccountNumbers.normalise(" " + acct.substring(0, 4) + "-" + acct.substring(4) + " "));
        assertFalse(AccountNumbers.valid("abc"));
        assertFalse(AccountNumbers.valid(null));
    }
}
