---
phase: 1
plan: 2
wave: 2
depends_on: ["1.1"]
files_modified: ["backend/migrations/004_add_rosca_tables.sql", "backend/tests/rosca_logic.test.js"]
autonomous: true
must_haves:
  truths:
    - "Swap request constraint correctly validates positions."
    - "Automated tests confirm trust sorting and payout logic."
  artifacts:
    - "backend/migrations/004_add_rosca_tables.sql updated."
    - "backend/tests/rosca_logic.test.js created."
---

# Plan 1.2: Database & Verification

<objective>
Correct the database constraint for ROSCA swap requests and implement automated verification tests for Phase 1 logic.
</objective>

<context>
- .gsd/SPEC.md
- backend/migrations/004_add_rosca_tables.sql
- backend/controllers/roscaController.js
</context>

<tasks>

<task type="auto">
  <name>Update Swap Request Constraint</name>
  <files>backend/migrations/004_add_rosca_tables.sql</files>
  <action>
    Correct the `valid_swap_request` constraint in the `rosca_swap_requests` table (line 47).
    Change `CHECK (requester_id != target_position)` to `CHECK (requester_id != (SELECT user_id FROM rosca_roster WHERE cycle_id = rosca_swap_requests.cycle_id AND position = target_position))`.
    *Refinement*: Actually, the logic should simply ensure a user doesn't request a swap with their own current position.
    AVOID: Comparing ID to Position.
  </action>
  <verify>Review the SQL file for the corrected CHECK constraint.</verify>
  <done>Database constraint correctly validates swap participants.</done>
</task>

<task type="auto">
  <name>Implement Verification Tests</name>
  <files>backend/tests/rosca_logic.test.js</files>
  <action>
    Create a new test using Mocha/Chai.
    Mock the database pool or use a test database.
    Test 1: Mock `chama_members` with varying trust scores and call `createCycle` in 'TRUST' mode. Verify roster order.
    Test 2: Mock a member with a single large contribution and verify `processPayout` logic allows eligibility for multiple rounds.
    AVOID: Reliance on external production data.
  </action>
  <verify>Run `npm test tests/rosca_logic.test.js`</verify>
  <done>Tests pass and cover the bugs fixed in Plan 1.1.</done>
</task>

</tasks>

<success_criteria>
- [ ] Swap constraint is logically sound.
- [ ] Automated tests verify the logic improvements from Phase 1.
</success_criteria>
