---
phase: 10
plan: 2
wave: 2
depends_on: ["10.1"]
files_modified: ["backend/controllers/ascaController.js", "backend/routes/ascaRoutes.js"]
autonomous: true

must_haves:
  truths:
    - "Treasurer can execute the final payout distribution."
    - "Payouts deduct from chama current_fund."
  artifacts:
    - "New route POST /api/asca/:chamaId/cycles/:cycleId/payout"
  key_links:
    - "Payout affects chamas.current_fund directly."
---

# Plan 10.2: Payout Execution & Reporting

<objective>
To physically process the settlement of the ASCA cycle. Once a cycle is closed and dividends calculated, the Treasurer records that the cash has been remitted to members, reducing the chama's liquid pool.

Purpose: To bring the ASCA cycle full circle—from collection, to lending, to interest generation, to final liquidity distribution.
Output: A payout endpoint that zeros out the cycle liabilities and cuts the chama fund balance.
</objective>

<context>
Load for context:
- backend/controllers/ascaController.js
</context>

<tasks>

<task type="auto">
  <name>Implement Cycle Payout Execution</name>
  <files>backend/controllers/ascaController.js</files>
  <action>
    Add `executeShareOutPayout`.
    1. Verify cycle is 'CLOSED_PENDING_PAYOUT'.
    2. Retrieve all members' (`total_investment` + `dividends_earned`).
    3. Sum total liability. Check if `chamas.current_fund` covers the liability.
    4. Deduct the total payout from `chamas.current_fund`.
    5. Update cycle status to 'COMPLETED'.
    6. Record audit log or generic expense ledger out-flows (optional, but adjust chamas table minimally).
    
    AVOID: Partial payouts. Share-outs usually distribute the entire pool.
  </action>
  <verify>curl -X POST localhost:5005/api/asca/:chamaId/cycles/:cycleId/payout returns 200</verify>
  <done>Cycle switches to COMPLETED and chama fund correctly drops</done>
</task>

<task type="auto">
  <name>Expose Payout Route</name>
  <files>backend/routes/ascaRoutes.js</files>
  <action>
    Add the payout execution endpoint explicitly for the Treasurer.
  </action>
  <verify>grep "executeShareOutPayout" backend/routes/ascaRoutes.js</verify>
  <done>Route exposed successfully</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Treasurer can execute the final payout distribution.
- [ ] Payouts deduct from chama current_fund.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
