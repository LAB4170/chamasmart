---
phase: 11
plan: 2
wave: 2
depends_on: ["11.1"]
files_modified: ["backend/controllers/loanController.js", "backend/routes/loanRoutes.js", "backend/migrations/040_loan_approvals.sql"]
autonomous: true

must_haves:
  truths:
    - "High-value ASCA loans require at least two officials to approve."
    - "A single official cannot bypass the queue."
  artifacts:
    - "New migration for loan_approvals table."
    - "New POST /api/loans/:loanId/approve endpoint for officials."
  key_links:
    - "Approve endpoint checks approval count before releasing funds."
---

# Plan 11.2: Multi-Official Loan Approval Queue

<objective>
To implement a robust governance step. Loans above a certain threshold (or all loans, optionally) should not be instantly dispersed. They require authorization from at least 2 officials (e.g., Chairperson and Treasurer) to prevent fraud.

Purpose: Security and governance transparency, matching real-world ASCA manual ledger signatures.
Output: A new `loan_approvals` table, an endpoint for officials to vote/approve, and a trigger to disperse only when threshold is met.
</objective>

<context>
Load for context:
- backend/controllers/loanController.js
- backend/routes/loanRoutes.js
</context>

<tasks>

<task type="auto">
  <name>Create Approval Schema Migration</name>
  <files>backend/migrations/040_loan_approvals.sql</files>
  <action>
    Create a new SQL script to create `loan_approvals` table.
    Columns: `id`, `loan_id` (FK), `official_user_id` (FK to users), `status` (APPROVED, REJECTED), `created_at`.
    Add unique constraint `UNIQUE(loan_id, official_user_id)`.
  </action>
  <verify>Test if SQL syntax is valid.</verify>
  <done>Table schema created correctly</done>
</task>

<task type="auto">
  <name>Implement Approval Endpoint & Threshold Check</name>
  <files>backend/controllers/loanController.js</files>
  <action>
    Add `approveLoanByOfficial`.
    1. Verify requester is official (CHAIRPERSON, TREASURER, SECRETARY).
    2. Insert into `loan_approvals`.
    3. Count total 'APPROVED' votes for `loan_id`.
    4. If votes >= 2 (or chama config threshold), update loan status to 'APPROVED' and trigger actual fund dispersal logic.
    5. Move existing single-step approval logic into the threshold met condition.
    
    AVOID: Allowing the borrower to approve their own loan if they happen to be an official.
  </action>
  <verify>grep "approveLoanByOfficial" backend/controllers/loanController.js</verify>
  <done>Multi-official approval logic blocks dispersal until minimum 2 votes.</done>
</task>

<task type="auto">
  <name>Route Configuration</name>
  <files>backend/routes/loanRoutes.js</files>
  <action>
    Expose the route `POST /:loanId/official-approve`.
  </action>
  <verify>grep "official-approve" backend/routes/loanRoutes.js</verify>
  <done>Endpoint is accessible by officials</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] High-value ASCA loans require at least two officials to approve.
- [ ] A single official cannot bypass the queue.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
