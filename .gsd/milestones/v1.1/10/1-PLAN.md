---
phase: 10
plan: 1
wave: 1
depends_on: []
files_modified: ["backend/controllers/ascaController.js", "backend/routes/ascaRoutes.js"]
autonomous: true

must_haves:
  truths:
    - "An official can officially close an ASCA cycle."
    - "Closing a cycle calculates final profit split and stops new transactions on that cycle."
  artifacts:
    - "New route POST /api/asca/:chamaId/cycles/:cycleId/close"
  key_links:
    - "Close cycle triggers dividend calculation implicitly."
---

# Plan 10.1: ASCA Cycle Closure & Final Dividends

<objective>
Implement the core action to close an ASCA cycle at the end of its term. This action MUST calculate the final dividends, freeze the cycle from further share purchases or loans, and update the member ledgers with their final cash-out amounts.

Purpose: To fulfill the standard Kenyan ASCA loop where a cycle is ultimately liquidated and profits generated are calculated definitively.
Output: A new endpoint to close a cycle and update its status to 'CLOSED' or 'COMPLETED'.
</objective>

<context>
Load for context:
- backend/controllers/ascaController.js
- backend/routes/ascaRoutes.js
- .gemini/antigravity/brain/f16a0c97-3f37-498b-9ed4-1681aac7b733/asca_analysis_report.md
</context>

<tasks>

<task type="auto">
  <name>Implement Cycle Closure Logic</name>
  <files>backend/controllers/ascaController.js</files>
  <action>
    Add a new function `closeAscaCycle`. 
    It should:
    1. Verify user is Chairperson/Treasurer/Secretary.
    2. Check cycle is currently 'ACTIVE'.
    3. Update cycle status to 'CLOSED_PENDING_PAYOUT'.
    4. Automatically calculate the total profit of the cycle (interest + penalties from loans linked to this chama) - or reuse/refactor existing dividend calculation logic.
    5. Update `asca_members` table for the cycle with their proportional final `dividends_earned`.
    
    AVOID: Reusing `distributeDividends` directly if it adds to `total_investment`. Closing a cycle implies the money is ready to leave the pool as cash, not be internally reinvested. Create a dedicated status updating mechanism.
  </action>
  <verify>curl -X POST localhost:5005/api/asca/:chamaId/cycles/:cycleId/close returns 200</verify>
  <done>Active cycle is marked as CLOSED_PENDING_PAYOUT and dividends calculate successfully</done>
</task>

<task type="auto">
  <name>Expose Closure Route</name>
  <files>backend/routes/ascaRoutes.js</files>
  <action>
    Add `router.post('/:chamaId/cycles/:cycleId/close', protect, authorize(...), closeAscaCycle)` mapping.
  </action>
  <verify>grep "closeAscaCycle" backend/routes/ascaRoutes.js</verify>
  <done>Route is properly mapped and exported</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] An official can officially close an ASCA cycle.
- [ ] Closing a cycle calculates final profit split and stops new transactions on that cycle.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
