---
phase: 36
plan: 1
wave: 1
---

# Plan 36.1: Total Financial Integrity (Hard-Locks & Auto-Payouts)

This phase elevates the financial reliability of ChamaSmart by removing human intervention from sensitive payouts and enforcing perfect cash reconciliation during live meetings.

## Objective
To implement rigid mathematical 'hard-locks' for Table Banking sessions, automated M-Pesa B2C payouts for ROSCA cycles, and optimized trust-based roster generation.

## Tasks

<task type="auto">
  <name>Table Banking: Hard-Lock Reconciliation</name>
  <files>backend/controllers/tableSessionController.js</files>
  <action>
    - Harden the `closeSession` logic to ensure no session can be closed in a `MATCHED` status unless the physical count is identical to the ledger.
    - Improve error reporting to provide a clear "Reconciliation Breakdown" (Opening + Collected - Disbursed = Expected).
  </action>
  <verify>Attempt to close a session with mismatched cash; verify it returns a 400 error with detailed breakdown.</verify>
  <done>Session closure is blocked unless cash balances perfectly.</done>
</task>

<task type="auto">
  <name>M-Pesa: B2C Payout Protocol</name>
  <files>backend/utils/mpesaService.js</files>
  <action>
    - Add a `initiateB2CPayout` method to the `MpesaService` class.
    - Implement a robust mock response for development mode.
    - Support environment variables for B2C Shortcode and Security Credentials.
  </action>
  <verify>Invoke the method in a scratch script and check the logs for successful mock/B2C execution.</verify>
  <done>M-Pesa service supports automated disbursements.</done>
</task>

<task type="auto">
  <name>ROSCA: Automated Cycle Payouts</name>
  <files>backend/controllers/roscaController.js, backend/controllers/contributionController.js</files>
  <action>
    - Create a helper `triggerAutoPayout(cycleId, position)` in `roscaController.js` that checks if a payout is due and executes it.
    - Integrate this hook in `contributionController.js` after any ROSCA contribution is successfully recorded (single and bulk).
  </action>
  <verify>Record the final contribution for a round and verify that the auto-payout logic is triggered in the logs.</verify>
  <done>ROSCA payouts happen automatically when the round pot is full.</done>
</task>

<task type="auto">
  <name>ROSCA: Trust-Score Roster Optimization</name>
  <files>backend/controllers/roscaController.js</files>
  <action>
    - Refactor the `TRUST` roster generation query to be more granular. 
    - Join with `users` to return names and weight 'Ghosting' or 'Active Loans' if necessary.
  </action>
  <verify>Preview a roster for a chama with multiple members of varying trust scores and verify the order is correct.</verify>
  <done>Roster generation is more precise and stable.</done>
</task>

## Success Criteria
- [ ] Table Banking enforces perfect mathematical reconciliation.
- [ ] M-Pesa B2C payouts are integrated and automated.
- [ ] ROSCA trust scores correctly drive payout order.
