---
phase: 35
plan: 1
wave: 1
---

# Plan 35.1: The 10/10 Evolution

## Objective
Elevate the ChamaSmart architecture to a perfect 10/10 rating based on the comprehensive audit by completing the final missing constraints across ROSCA, Table Banking, and Backend Developer Operations.

## Context
- .gsd/SPEC.md
- chama_final_audit.md (from artifacts)
- backend/routes/rosca.js
- backend/controllers/meetingController.js
- backend/tests/

## Tasks

<task type="auto">
  <name>Jest Mocks & Code Quality</name>
  <files>backend/tests/*.test.js, backend/package.json, frontend/package.json</files>
  <action>
    - Add a `.prettierrc` file in the backend to set `endOfLine: "auto"` to resolve 28,000 Windows CRLF lint errors.
    - Rewrite the Jest auth middleware mocks to properly simulate Firebase verification and the new `isSecretary` / `isTreasurer` RBAC layers.
    - Resolve `process.env` linting errors in the frontend by switching them to `import.meta.env`.
  </action>
  <verify>npm run lint in frontend and backend; npm run test in backend returns 100% pass rate</verify>
  <done>Zero ESLint line-break warnings and green test suite.</done>
</task>

<task type="auto">
  <name>Table Banking: Hard-Lock Reconciliation</name>
  <files>backend/controllers/meetingController.js, backend/routes/meetings.js</files>
  <action>
    - Overhaul the `closeSession` logic so that the session CANNOT be closed if `closingCashSummary !== (opening + collected - disbursed)`.
    - Throw a strict 400 error requiring the Treasurer to reconcile the missing cash out of pocket or via fines before locking the physical table.
  </action>
  <verify>Create a test meeting, imbalance the cash, and verify `closeSession` blocks it.</verify>
  <done>API returns 400 when physical cash ledger doesn't match the system ledger during closure.</done>
</task>

<task type="auto">
  <name>ROSCA: Auto M-Pesa B2C Payouts</name>
  <files>backend/controllers/roscaController.js</files>
  <action>
    - Update the `processCycleContributions` cycle observer. When the final contribution for a round is received and `unpaidCount === 0`, automatically trigger a simulated M-Pesa B2C API call to disburse the total pot to the current recipient.
    - This replaces the Treasurer-gated manual payout process with an automated smart contract style release.
  </action>
  <verify>Simulate the final contribution of a cycle and check the server logs for the B2C execution logic.</verify>
  <done>Automated disbursement logic is triggered instantly when the cycle pool is full.</done>
</task>

## Success Criteria
- [ ] 100% unit test pass rate.
- [ ] Zero ESLint CRLF warnings.
- [ ] Table Banking enforces mathematical physical cash perfection.
- [ ] ROSCA pays out automatically without human intervention once the pot is full.
