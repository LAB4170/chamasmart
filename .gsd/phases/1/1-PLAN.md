---
phase: 1
plan: 1
wave: 1
depends_on: []
files_modified: ["backend/controllers/roscaController.js"]
autonomous: true
must_haves:
  truths:
    - "Trust scores for ROSCA cycle creation are pulled from chama_members table."
    - "Payout eligibility calculation correctly handles multiple contributions for different rounds."
  artifacts:
    - "backend/controllers/roscaController.js contains the updated queries."
---

# Plan 1.1: Core ROSCA Logic Fixes

<objective>
Stabilize the core financial logic in the ROSCA controller by fixing the trust score data source and the payout eligibility calculation.
</objective>

<context>
- .gsd/SPEC.md
- backend/controllers/roscaController.js
</context>

<tasks>

<task type="auto">
  <name>Fix Trust Score Integration</name>
  <files>backend/controllers/roscaController.js</files>
  <action>
    Modify the query in `createCycle` (around line 100) to join `users` with `chama_members` on `user_id`.
    Retrieve `trust_score` from `chama_members` instead of `users`.
    AVOID: Using the general `users` table because `TrustScoreService` updates membership-context scores.
  </action>
  <verify>Check that the SQL query includes a JOIN with chama_members.</verify>
  <done>Query correctly fetches chama-specific trust scores.</done>
</task>

<task type="auto">
  <name>Fix Payout Eligibility Logic</name>
  <files>backend/controllers/roscaController.js</files>
  <action>
    Update the `unpaidCount` query in `processPayout` (around line 354).
    Change the subquery from `SELECT COUNT(*) FROM contributions` to `SELECT SUM(amount) FROM contributions`.
    Compare `SUM(amount) / cycle.contribution_amount >= payoutPosition`.
    AVOID: Round counting by rows, as one row can represent multiple payment rounds.
  </action>
  <verify>Check that the SQL query now uses SUM(amount) and division logic.</verify>
  <done>Payout eligibility is calculated based on total amount contributed.</done>
</task>

</tasks>

<success_criteria>
- [ ] Trust score query correctly joins `chama_members`.
- [ ] Payout eligibility uses amount submission sums instead of row counts.
</success_criteria>
