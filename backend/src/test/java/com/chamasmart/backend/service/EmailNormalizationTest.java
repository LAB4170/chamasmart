package com.chamasmart.backend.service;

import com.chamasmart.backend.config.EmailNormalizationRunner;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EmailNormalizationTest {
    private static User user(long id, String email) {
        User u = new User();
        u.setUserId(id);
        u.setEmail(email);
        return u;
    }

    private static int run(EmailNormalizationRunner r) throws Exception {
        Method m = EmailNormalizationRunner.class.getDeclaredMethod("normalize");
        m.setAccessible(true);
        return (int) m.invoke(r);
    }

    @Test
    void mixedCaseEmailsAreLowercasedAndAlreadyLowercaseOnesAreLeftAlone() throws Exception {
        UserRepository repo = Mockito.mock(UserRepository.class);
        User mixed = user(1, "Jane.Doe@Gmail.com");
        User lower = user(2, "john@x.com");
        Mockito.when(repo.findAll()).thenReturn(List.of(mixed, lower));
        assertEquals(1, run(new EmailNormalizationRunner(repo)));
        assertEquals("jane.doe@gmail.com", mixed.getEmail());
        assertEquals("john@x.com", lower.getEmail());
        Mockito.verify(repo, Mockito.times(1)).save(Mockito.any());
    }

    @Test
    void anAccountIsSkippedWhenItsLowercaseFormBelongsToSomeoneElse() throws Exception {
        UserRepository repo = Mockito.mock(UserRepository.class);
        User mixed = user(1, "Jane@x.com");
        User other = user(2, "jane@x.com");
        Mockito.when(repo.findAll()).thenReturn(List.of(mixed, other));
        assertEquals(0, run(new EmailNormalizationRunner(repo)));
        assertEquals("Jane@x.com", mixed.getEmail());
    }
}
