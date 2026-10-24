package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.LoanSummaryDto;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LoanServiceTest {
    @Mock LoanRepository loanRepo;
    @Mock LoanGuarantorRepository guarantorRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock UserRepository userRepo;
    @Mock ChamaMemberRepository memberRepo;
    @Mock FinancialAuditLogRepository auditRepo;
    @Mock LoanConfigRepository configRepo;
    @Mock LoanRepaymentRepository repaymentRepo;
    @InjectMocks LoanService service;

    Chama chama;
    Loan mine, theirs;

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }

    private Loan loan(long id, User borrower) {
        Loan l = new Loan();
        l.setLoanId(id); l.setChama(chama); l.setBorrower(borrower);
        l.setLoanAmount(new BigDecimal("1000")); l.setTotalRepayable(new BigDecimal("1100")); l.setAmountPaid(BigDecimal.ZERO);
        l.setStatus("DISBURSED");
        return l;
    }

    private void member(long userId, String role, boolean active) {
        ChamaMember m = ChamaMember.builder().role(role).isActive(active).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, userId)).thenReturn(Optional.of(m));
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").currentFund(new BigDecimal("5000")).build();
        mine = loan(10, user(5)); theirs = loan(11, user(6));
        when(loanRepo.findByChamaChamaId(1L)).thenReturn(List.of(mine, theirs));
        when(loanRepo.findById(11L)).thenReturn(Optional.of(theirs));
        when(configRepo.findByChamaId(1L)).thenReturn(Optional.empty());
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(userRepo.findById(5L)).thenReturn(Optional.of(user(5)));
        when(userRepo.findById(8L)).thenReturn(Optional.of(user(8)));
    }

    private com.chamasmart.backend.dto.LoanApplicationRequestDto request(String amount, int term, com.chamasmart.backend.dto.LoanApplicationRequestDto.GuarantorPledgeDto... g) {
        return com.chamasmart.backend.dto.LoanApplicationRequestDto.builder().chama_id(1L).loan_amount(new BigDecimal(amount)).term_months(term).purpose("x").guarantors(List.of(g)).build();
    }
    private static com.chamasmart.backend.dto.LoanApplicationRequestDto.GuarantorPledgeDto pledge(long user, String amt) {
        return com.chamasmart.backend.dto.LoanApplicationRequestDto.GuarantorPledgeDto.builder().user_id(user).guarantee_amount(new BigDecimal(amt)).build();
    }
    private void borrowerWithSavings(String savings) {
        ChamaMember m = ChamaMember.builder().role("MEMBER").isActive(true).totalContributions(new BigDecimal(savings)).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 5L)).thenReturn(Optional.of(m));
        ChamaMember g = ChamaMember.builder().role("MEMBER").isActive(true).totalContributions(new BigDecimal("50000")).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 8L)).thenReturn(Optional.of(g));
    }

    @Test void interestFollowsTheChamaConfigNotAHardcodedRate() {
        borrowerWithSavings("10000");
        when(loanRepo.save(any(Loan.class))).thenAnswer(i -> i.getArgument(0));
        // defaults: 10% annual flat -> 10000 x 10 x 6 / 1200 = 500 interest
        service.applyForLoan(request("10000", 6, pledge(8, "10500")), 5L);
        org.mockito.ArgumentCaptor<Loan> c = org.mockito.ArgumentCaptor.forClass(Loan.class);
        verify(loanRepo).save(c.capture());
        assertEquals(0, new BigDecimal("10500.00").compareTo(c.getValue().getTotalRepayable()));
        assertEquals(0, new BigDecimal("1750.00").compareTo(c.getValue().getMonthlyPayment()));
        assertEquals(java.time.LocalDate.now().plusMonths(6), c.getValue().getDueDate());
    }

    @Test void applicationAboveBorrowingLimitIsRejected() {
        borrowerWithSavings("1000"); // limit 3000
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("3500", 3, pledge(8, "4000")), 5L));
        verify(loanRepo, never()).save(any());
    }

    @Test void termBeyondOfficialsMaximumIsRejected() {
        borrowerWithSavings("10000");
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("1000", 13, pledge(8, "2000")), 5L));
    }

    @Test void guarantorsMustCoverTheRepayableAmount() {
        borrowerWithSavings("10000");
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("10000", 6, pledge(8, "5000")), 5L));
    }

    @Test void guarantorWithADefaultedLoanIsRefused() {
        borrowerWithSavings("10000");
        Loan bad = loan(20, user(8)); bad.setStatus("DEFAULTED");
        when(loanRepo.findByBorrowerUserId(8L)).thenReturn(List.of(bad));
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("1000", 3, pledge(8, "2000")), 5L));
    }

    @Test void guarantorCannotPledgeBeyondTheirCapacity() {
        borrowerWithSavings("10000");
        ChamaMember small = ChamaMember.builder().role("MEMBER").isActive(true).totalContributions(new BigDecimal("100")).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 8L)).thenReturn(Optional.of(small)); // capacity 300
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("1000", 3, pledge(8, "1050")), 5L));
    }

    @Test void cannotGuaranteeYourOwnLoan() {
        borrowerWithSavings("10000");
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("1000", 3, pledge(5, "2000")), 5L));
    }

    @Test void approvalWaitsForEveryGuarantor() {
        member(7, "TREASURER", true);
        Loan pending = loan(12, user(5)); pending.setStatus("PENDING");
        when(loanRepo.findByIdWithPessimisticLock(12L)).thenReturn(Optional.of(pending));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        LoanGuarantor lg = LoanGuarantor.builder().loan(pending).guarantorUser(user(8)).guaranteeAmount(new BigDecimal("1100")).status("PENDING").build();
        when(guarantorRepo.findByLoanLoanId(12L)).thenReturn(List.of(lg));
        assertThrows(IllegalStateException.class, () -> service.approveLoan(12L, 7L));
        assertEquals(new BigDecimal("5000"), chama.getCurrentFund());
    }

    @Test void officialCannotApproveTheirOwnLoan() {
        member(5, "TREASURER", true);
        Loan own = loan(13, user(5)); own.setStatus("PENDING");
        when(loanRepo.findByIdWithPessimisticLock(13L)).thenReturn(Optional.of(own));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        assertThrows(AccessDeniedException.class, () -> service.approveLoan(13L, 5L));
    }

    @Test void onlyTheBorrowerCanRepayAnActiveLoan() {
        member(8, "MEMBER", true);
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        assertThrows(AccessDeniedException.class, () -> service.repayLoan(10L, new BigDecimal("100"), 8L));
        verify(chamaRepo, never()).save(any());
    }

    @Test void defaultedLoanRepaymentWaitsForVerificationAndMovesNoMoney() {
        member(5, "MEMBER", true);
        mine.setStatus("DEFAULTED");
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        when(repaymentRepo.findByLoanId(10L)).thenReturn(List.of());
        when(repaymentRepo.save(any(LoanRepayment.class))).thenAnswer(i -> i.getArgument(0));
        LoanRepayment r = service.repayLoan(10L, new BigDecimal("100"), 5L);
        assertEquals("PENDING", r.getStatus());
        assertEquals(new BigDecimal("5000"), chama.getCurrentFund());
        assertEquals(0, BigDecimal.ZERO.compareTo(mine.getAmountPaid()));
        verify(chamaRepo, never()).save(any());
    }

    private LoanRepayment pending(long id, long payer, String amount) {
        return LoanRepayment.builder().repaymentId(id).loan(mine).payer(user(payer)).amount(new BigDecimal(amount)).status("PENDING").build();
    }

    @Test void verifyingARepaymentCreditsTheLoanAndTheFund() {
        member(7, "TREASURER", true);
        LoanRepayment r = pending(1, 5, "400");
        when(repaymentRepo.findById(1L)).thenReturn(Optional.of(r));
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        service.verifyRepayment(1L, 1L, 7L);
        assertEquals("VERIFIED", r.getStatus());
        assertEquals(new BigDecimal("5400"), chama.getCurrentFund());
        assertEquals(new BigDecimal("400"), mine.getAmountPaid());
    }

    @Test void finalVerifiedRepaymentCompletesTheLoan() {
        member(7, "TREASURER", true);
        mine.setAmountPaid(new BigDecimal("700"));
        LoanRepayment r = pending(1, 5, "400");
        when(repaymentRepo.findById(1L)).thenReturn(Optional.of(r));
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        service.verifyRepayment(1L, 1L, 7L);
        assertEquals("COMPLETED", mine.getStatus());
    }

    @Test void anOfficialCannotVerifyTheirOwnRepayment() {
        member(5, "TREASURER", true);
        when(repaymentRepo.findById(1L)).thenReturn(Optional.of(pending(1, 5, "400")));
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        assertThrows(AccessDeniedException.class, () -> service.verifyRepayment(1L, 1L, 5L));
        verify(chamaRepo, never()).save(any());
    }

    @Test void aPlainMemberCannotVerifyARepayment() {
        member(8, "MEMBER", true);
        when(repaymentRepo.findById(1L)).thenReturn(Optional.of(pending(1, 5, "400")));
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        assertThrows(AccessDeniedException.class, () -> service.verifyRepayment(1L, 1L, 8L));
    }

    @Test void aRepaymentCanOnlyBeDecidedOnce() {
        member(7, "TREASURER", true);
        LoanRepayment r = pending(1, 5, "400");
        r.setStatus("VERIFIED");
        when(repaymentRepo.findById(1L)).thenReturn(Optional.of(r));
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        assertThrows(IllegalStateException.class, () -> service.verifyRepayment(1L, 1L, 7L));
        assertThrows(IllegalStateException.class, () -> service.rejectRepayment(1L, 1L, 7L, "x"));
    }

    @Test void rejectedRepaymentMovesNoMoney() {
        member(7, "CHAIRPERSON", true);
        LoanRepayment r = pending(1, 5, "400");
        when(repaymentRepo.findById(1L)).thenReturn(Optional.of(r));
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        service.rejectRepayment(1L, 1L, 7L, "no receipt");
        assertEquals("REJECTED", r.getStatus());
        assertEquals(new BigDecimal("5000"), chama.getCurrentFund());
        assertEquals(0, BigDecimal.ZERO.compareTo(mine.getAmountPaid()));
    }

    @Test void repaymentsAlreadyAwaitingVerificationCountAgainstTheBalance() {
        member(5, "MEMBER", true);
        mine.setStatus("APPROVED");
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        when(repaymentRepo.findByLoanId(10L)).thenReturn(List.of(pending(1, 5, "1000")));
        assertThrows(IllegalArgumentException.class, () -> service.repayLoan(10L, new BigDecimal("101"), 5L));
    }

    @Test void borrowingLimitIsNetOfLoansStillOwed() {
        borrowerWithSavings("1000"); // gross limit 3000
        Loan open = loan(20, user(5));
        open.setLoanAmount(new BigDecimal("2000")); open.setTotalRepayable(new BigDecimal("2000")); open.setStatus("DISBURSED");
        when(loanRepo.findByBorrowerUserId(5L)).thenReturn(List.of(open));
        // only 1000 of headroom is left
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("1500", 3, pledge(8, "4000")), 5L));
        verify(loanRepo, never()).save(any());
    }

    @Test void repaidPartOfALoanFreesUpBorrowingRoom() {
        Loan half = loan(21, user(5));
        half.setLoanAmount(new BigDecimal("2000")); half.setTotalRepayable(new BigDecimal("2000")); half.setAmountPaid(new BigDecimal("1000")); half.setStatus("DISBURSED");
        assertEquals(0, new BigDecimal("1000").compareTo(LoanService.outstandingPrincipal(List.of(half), 1L).setScale(0, java.math.RoundingMode.HALF_UP)));
    }

    @Test void aDefaultedBorrowerCannotTakeAnotherLoan() {
        borrowerWithSavings("10000");
        Loan bad = loan(22, user(5)); bad.setStatus("DEFAULTED");
        when(loanRepo.findByBorrowerUserId(5L)).thenReturn(List.of(bad));
        assertThrows(IllegalArgumentException.class, () -> service.applyForLoan(request("1000", 3, pledge(8, "2000")), 5L));
    }

    @Test void calculatorScheduleSumsExactlyToTheTotal() {
        for (String type : new String[]{LoanCalculator.FLAT, LoanCalculator.REDUCING}) {
            BigDecimal p = new BigDecimal("10000");
            BigDecimal interest = LoanCalculator.totalInterest(p, new BigDecimal("12"), 7, type);
            var rows = LoanCalculator.schedule(p, new BigDecimal("12"), 7, type, java.time.LocalDate.of(2026, 1, 31), interest);
            BigDecimal sum = rows.stream().map(LoanCalculator.Installment::total).reduce(BigDecimal.ZERO, BigDecimal::add);
            assertEquals(0, p.add(interest).compareTo(sum), type);
            assertEquals(0, BigDecimal.ZERO.compareTo(rows.get(rows.size() - 1).balanceAfter()), type);
        }
        // reducing balance charges less interest than flat for the same rate and term
        assertTrue(LoanCalculator.totalInterest(new BigDecimal("10000"), new BigDecimal("12"), 6, LoanCalculator.REDUCING)
                .compareTo(LoanCalculator.totalInterest(new BigDecimal("10000"), new BigDecimal("12"), 6, LoanCalculator.FLAT)) < 0);
    }

    @Test void nonMemberCannotListChamaLoans() {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 99L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> service.getChamaLoans(1L, 99L));
    }

    @Test void inactiveMemberCannotListChamaLoans() {
        member(5, "MEMBER", false);
        assertThrows(AccessDeniedException.class, () -> service.getChamaLoans(1L, 5L));
    }

    @Test void ordinaryMemberSeesOnlyOwnLoans() {
        member(5, "MEMBER", true);
        List<LoanSummaryDto> r = service.getChamaLoans(1L, 5L);
        assertEquals(1, r.size());
        assertEquals(10L, r.get(0).getLoan_id());
    }

    @Test void officerSeesAllLoans() {
        member(7, "TREASURER", true);
        assertEquals(2, service.getChamaLoans(1L, 7L).size());
    }

    @Test void memberCannotOpenSomeoneElsesLoan() {
        member(5, "MEMBER", true);
        assertThrows(AccessDeniedException.class, () -> service.getChamaLoan(1L, 11L, 5L));
    }

    @Test void loanFromAnotherChamaIsNotFoundThroughThisChama() {
        member(7, "CHAIRPERSON", true);
        assertThrows(RuntimeException.class, () -> service.getChamaLoan(2L, 11L, 7L));
    }

    @Test void repaymentMustBePositive() {
        member(5, "MEMBER", true);
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        mine.setStatus("APPROVED");
        assertThrows(IllegalArgumentException.class, () -> service.repayLoan(10L, new BigDecimal("-500"), 5L));
        assertThrows(IllegalArgumentException.class, () -> service.repayLoan(10L, BigDecimal.ZERO, 5L));
        verify(chamaRepo, never()).save(any());
    }

    @Test void repaymentCannotExceedBalance() {
        member(5, "MEMBER", true);
        when(loanRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(mine));
        mine.setStatus("APPROVED");
        assertThrows(IllegalArgumentException.class, () -> service.repayLoan(10L, new BigDecimal("1100.01"), 5L));
        verify(chamaRepo, never()).save(any());
    }
}
