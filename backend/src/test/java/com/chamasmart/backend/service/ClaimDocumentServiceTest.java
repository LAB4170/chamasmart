package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClaimDocumentServiceTest {
    @Mock ClaimDocumentRepository docs;
    @Mock WelfareClaimRepository claims;
    @Mock ChamaMemberRepository members;
    @Mock FinancialAuditLogRepository audit;
    @Mock UserRepository users;
    ClaimDocumentService service;
    WelfareClaim claim;
    Chama chama;
    static final byte[] PDF = "%PDF-1.4 test".getBytes();

    private static User user(long id) { User u = new User(); u.setUserId(id); return u; }

    private void member(long id, String role) {
        when(members.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(ChamaMember.builder().chama(chama).user(user(id)).role(role).isActive(true).build()));
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").build();
        claim = WelfareClaim.builder().claimId(9L).chama(chama).member(user(8)).status("SUBMITTED").build();
        when(claims.findById(9L)).thenReturn(Optional.of(claim));
        when(docs.save(any())).thenAnswer(i -> { ClaimDocument d = i.getArgument(0); d.setDocumentId(1L); return d; });
        service = new ClaimDocumentService(docs, claims, members, audit, users);
        member(8, "MEMBER"); member(7, "TREASURER"); member(6, "MEMBER");
    }

    @Test
    void claimantCanAttachAProofFile() {
        var out = service.add(9L, 8L, "cert.pdf", PDF);
        assertEquals("application/pdf", out.get("content_type"));
        verify(audit).save(any());
    }

    @Test
    void onlyTheClaimantAttachesAndOnlyWhileOpen() {
        assertThrows(AccessDeniedException.class, () -> service.add(9L, 7L, "x.pdf", PDF));
        claim.setStatus("APPROVED");
        assertThrows(IllegalStateException.class, () -> service.add(9L, 8L, "x.pdf", PDF));
    }

    @Test
    void fakeFilesAndTooManyFilesAreRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.add(9L, 8L, "x.pdf", "<script>".getBytes()));
        when(docs.countByClaimClaimId(9L)).thenReturn(3L);
        assertThrows(IllegalStateException.class, () -> service.add(9L, 8L, "x.pdf", PDF));
    }

    @Test
    void otherMembersCannotSeeProofButOfficialsAndClaimantCan() {
        assertThrows(AccessDeniedException.class, () -> service.list(9L, 6L));
        assertDoesNotThrow(() -> service.list(9L, 7L));
        assertDoesNotThrow(() -> service.list(9L, 8L));
    }

    @Test
    void aDocumentFromAnotherClaimIsNotServed() {
        WelfareClaim other = WelfareClaim.builder().claimId(10L).chama(chama).member(user(8)).build();
        when(docs.findById(5L)).thenReturn(Optional.of(ClaimDocument.builder().documentId(5L).claim(other).data(PDF).build()));
        assertThrows(IllegalArgumentException.class, () -> service.get(9L, 5L, 8L));
    }
}
