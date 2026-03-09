---
phase: 16
plan: 1
wave: 1
---

# Plan 16.1: Real ROSCA Contributions Backend

## Objective
The ROSCA frontend currently "simulates" payments. We need standard endpoints to store ROSCA cycle payments into the `contributions` table. We also need endpoints to view these contributions (the cycle ledger).

## Context
- .gsd/SPEC.md
- backend/controllers/roscaController.js
- backend/routes/roscaRoutes.js
- frontend/src/services/features.service.js

## Tasks

<task type="auto">
  <name>Implement ROSCA Backend Endpoints</name>
  <files>
    backend/controllers/roscaController.js
    backend/routes/roscaRoutes.js
  </files>
  <action>
    - In `roscaController.js`: Add a `makeContribution` function that:
      - Validates req.body (amount).
      - Inserts a record into the `contributions` table with `chama_id`, `user_id`, `amount`, `cycle_id = req.params.cycleId`, status = 'COMPLETED', and `contribution_type = 'ROSCA'`.
    - In `roscaController.js`: Add `getContributions` to list all contributions for a given `cycle_id`.
    - In `roscaController.js`: Add `getMemberStatement` to list all contributions and payouts for a specific user in a `cycle_id`.
    - In `roscaRoutes.js`: Expose these controller methods under `/:chamaId/cycles/:cycleId/contributions` and `/:chamaId/cycles/:cycleId/members/:memberId/statement`.
    - Verify authentication middleware handles these correctly.
  </action>
  <verify>grep -q "makeContribution" backend/controllers/roscaController.js && grep -q "getMemberStatement" backend/routes/roscaRoutes.js</verify>
  <done>The backend can ingest and return real ROSCA cycle contributions.</done>
</task>

<task type="auto">
  <name>Integrate Frontend Service and Dashboard</name>
  <files>
    frontend/src/services/features.service.js
    frontend/src/pages/chama/rosca/RoscaDashboard.jsx
  </files>
  <action>
    - In `features.service.js`: Add `makeContribution(chamaId, cycleId, payload)`, `getContributions`, and `getMemberStatement` to `roscaAPI`.
    - In `RoscaDashboard.jsx`: Replace the simulated 2000ms timeout in `handlePay` with a real call to `roscaAPI.makeContribution`. On success, show the toast and reload the dashboard or UI elements.
  </action>
  <verify>grep -q "makeContribution" frontend/src/services/features.service.js</verify>
  <done>Frontend payment modal submits a real transaction to the backend.</done>
</task>

<task type="auto">
  <name>Build Frontend Ledger UI</name>
  <files>
    frontend/src/components/rosca/RoscaCycleLedger.jsx
    frontend/src/pages/chama/rosca/RoscaDetails.jsx
  </files>
  <action>
    - Create `RoscaCycleLedger.jsx`: A pure React component that receives a list of members and contributions from props, and renders a table showing who has paid for the current round.
    - In `RoscaDetails.jsx`: Fetch `roscaAPI.getContributions` on mount. Add a new tab toggle or split layout to display the "Payment Ledger" next to the "Sequence/Timeline".
    - Highlight members who owe the contribution amount for the active installment.
  </action>
  <verify>cat frontend/src/components/rosca/RoscaCycleLedger.jsx</verify>
  <done>Administrators and members can transparently monitor the actual funds dropped into the round.</done>
</task>

## Success Criteria
- [ ] Backend records `cycle_id` into the `contributions` table seamlessly.
- [ ] Users can visibly see their payments update the cycle ledger.
- [ ] The "Simulation" mock code is permanently removed.
