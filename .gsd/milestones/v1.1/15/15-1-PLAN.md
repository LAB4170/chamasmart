---
phase: 15
plan: 1
wave: 1
---

# Plan 15.1: Treasury Liquidity Security Protocols

## Objective
Patch a critical financial vulnerability where `applyForLoan` and `approveLoan` allow members to request and Officials to disburse loans that mathematically exceed the total physical funds the Chama holds. 

## Files to Modify

### 1. `backend/controllers/loanController.js`
**Target Functions:**
- `applyForLoan`
- `approveLoan`
- `approveLoanByOfficial`

**Implementation Steps:**

1. **Calculate Available Treasury:** 
   Before approving or accepting a loan application, the system MUST compute the Chama's actual unallocated pool. 
   
   *Formula for Table Banking / Basic Chamas:* 
   `Available Pool = Total Member Contributions (chama_members.total_contributions) - Total Outstanding Principal (loans.principal_outstanding where status in ACTIVE, PENDING_APPROVAL, PENDING_GUARANTOR)`

   *Formula for ASCA:*
   `Available Pool = Total Cycle Investments (asca_members.total_investment) - Total Outstanding Principal for Cycle`

2. **Inject Pool Guardians in `applyForLoan`:**
   After calculating `maxLoan` (based on member savings * multiplier), compute the `availablePool`.
   If `req.body.amount > availablePool`, reject the application with HTTP 400:
   `"Insufficient Chama Treasury: The requested amount exceeds the unallocated funds currently available in the Chama pool."`

3. **Inject Pool Guardians in `approveLoan` / `approveLoanByOfficial`:**
   Even if the pool was sufficient during application, another loan might have been disbursed causing a race condition.
   Before setting `status = 'approved'`, recalculate `availablePool`.
   If `approvedAmount > availablePool`, reject the approval with HTTP 400:
   `"Approval Failed: The requested amount exceeds the unallocated funds currently available in the Chama pool due to other recent disbursements."`

## Expected Outcome
The system will categorically deny any loan request or approval that attempts to withdraw money the Chama does not physically possess, securing the financial integrity of the platform for a production scale.
