---
phase: 14
plan: 1
wave: 1
---

# Plan 14.1: API Integration & Base UI Structure

## Objective
Integrate the existing `getChamaLoanAnalytics` backend endpoint into the frontend network layer and establish the base `LoanAnalyticsDashboard.jsx` component to consume it. The objective is to wire up the data to the UI before focusing on visual flourishes and charts.

## Context
- Backend already has `/api/loans/:chamaId/reports/analytics` implemented in `loanController.js` and `loans.js` router.
- `frontend/src/services/finance.service.js` handles loan network calls.
- `frontend/src/pages/chama/loans/LoanManagement.jsx` needs a "Dashboard" tab integrated.

## Tasks

<task type="auto">
  <name>Endpoint Integration in Service Layer</name>
  <files>frontend/src/services/finance.service.js</files>
  <action>
    - Open `finance.service.js` and locate the `loanAPI` object.
    - Add a new method: `getAnalytics: (chamaId) => api.get(\`/loans/\${chamaId}/reports/analytics\`)`
    - Ensure it is exported properly with the rest of the API object functions.
  </action>
  <verify>grep -n "getAnalytics" frontend/src/services/finance.service.js</verify>
  <done>Method exists and constructs correct URL path</done>
</task>

<task type="auto">
  <name>Scaffold LoanAnalyticsDashboard Component</name>
  <files>
    frontend/src/pages/chama/loans/LoanAnalyticsDashboard.jsx
    frontend/src/pages/chama/loans/LoanManagement.jsx
  </files>
  <action>
    - Create `LoanAnalyticsDashboard.jsx` mimicking the premium styling of `ChamaDetails.jsx` reports tab.
    - Setup state for `analyticsData` and `loading`.
    - `useEffect` to call `loanAPI.getAnalytics(chamaId)` on mount.
    - In `LoanManagement.jsx`, add a standard tab navigation for ["Active Loans", "Dashboard"] if user is an Official (Treasury/Admin/Chair). Only render `LoanAnalyticsDashboard` when the Dashboard tab is active.
    - Stub out 4 simple summary cards for: Interest Earned, Outstanding Balance, Default Rate (%), and Active Loans Count.
  </action>
  <verify>grep -n "LoanAnalyticsDashboard" frontend/src/pages/chama/loans/LoanManagement.jsx</verify>
  <done>New component fetches real data and renders basic metrics, wired into LoanManagement securely.</done>
</task>

## Success Criteria
- [ ] `loanAPI.getAnalytics` successfully fetches data from the backend.
- [ ] `LoanAnalyticsDashboard` mounts and displays unformatted raw summary data.
- [ ] Dashboard is accessible via tab in `LoanManagement.jsx` ONLY for officials.
