---
phase: 11
plan: 1
wave: 1
depends_on: []
files_modified: ["backend/controllers/loanController.js"]
autonomous: true

must_haves:
  truths:
    - "An ASCA member cannot borrow more than 3x the value of their shares in the active cycle."
  artifacts:
    - "Updated loan eligibility criteria in loan controller."
  key_links:
    - "Loan request validates against asca_members instead of generic chama_members."
---

# Plan 11.1: ASCA Specific Loan Eligibility Rules

<objective>
To harden the loan eligibility engine. Currently, any chama member can borrow based on generic `total_contributions`. For an ASCA, borrowing power MUST be strictly tied to their `shares_owned` in the currently active ASCA cycle to protect the fund's integrity and match standard Kenyan ASCA practices.

Purpose: Prevent members from borrowing against generic savings and restrict it to their active ASCA equity (e.g., Max Loan = 3x Active Cycle Equity).
Output: A fully secured loan application endpoint that conditionally applies strict 3x multipliers for ASCA chamas.
</objective>

<context>
Load for context:
- backend/controllers/loanController.js
</context>

<tasks>

<task type="auto">
  <name>Harden ASCA Loan Eligibility</name>
  <files>backend/controllers/loanController.js</files>
  <action>
    Modify `requestLoan`.
    1. Detect if the chama is type 'ASCA'.
    2. If ASCA, fetch the 'ACTIVE' `asca_cycles` ID.
    3. Query `asca_members` for the applicant's `total_investment` (or `shares_owned` * `share_price`) in that active cycle.
    4. Enforce `maxEligibleAmount = total_investment * 3`.
    5. Block the loan request if `amount > maxEligibleAmount`, throwing a specific "ASCA Loan Limit Exceeded" error.
    
    AVOID: Breaking ROSCA or general chama loan requests. Ensure logic is conditionally wrapped `if (chama.chama_type === 'ASCA')`.
  </action>
  <verify>grep "total_investment" backend/controllers/loanController.js</verify>
  <done>ASCA loan requests correctly query active cycle equity and block requests > 3x</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] An ASCA member cannot borrow more than 3x the value of their shares in the active cycle.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
