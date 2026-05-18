# Comprehensive Migration Test Plan

## Overview
The application recently migrated from Node.js (Express) to Java (Spring Boot). During this migration, several JavaScript artifacts were left behind (`test-auth.js`, `test-http.js`) which have now been cleaned up. 

Most critically, the frontend Vite application was crashing or failing because it attempted to communicate with API endpoints that were **never implemented** in the new Spring Boot controllers. 

## Action Taken
To resolve the immediate crashes (404 errors), **stub endpoints** have been added to the following Spring Boot controllers:
- `RoscaController` (13 endpoints added)
- `LoanController` (9 endpoints added)
- `ChamaController` (3 endpoints added)

These endpoints now return HTTP 200 OK with empty/stubbed data, allowing the frontend workflows (like viewing loan details, loading ROSCA cycles, and browsing chamas) to render without completely crashing the UI.

## Execution & Testing Plan

### Phase 1: Verify UI Stability (Immediate)
1. **Frontend Boot**: Start the frontend using `npm run dev` (Done).
2. **Navigation Test**: Log in to the application and navigate through:
   - Dashboard
   - Chama Directory
   - Loan Application Workflow
   - ROSCA Management page
3. **Outcome**: The pages should no longer white-screen or crash with `404 Not Found` Axios errors.

### Phase 2: Implement Core Business Logic (Backend)
The added stub endpoints currently return `null` or empty data. The next phase requires implementing the underlying `RoscaService`, `LoanService`, and `ChamaService` logic for these methods.

**High Priority Endpoints to Implement:**
1. **Loans:** `GET /loans/{chamaId}` & `GET /loans/{chamaId}/{loanId}`
2. **ROSCA:** `GET /rosca/cycles/{cycleId}` & `GET /rosca/cycles/{cycleId}/roster`
3. **Contributions:** `POST /rosca/chamas/{chamaId}/cycles/{cycleId}/contributions`

### Phase 3: Integration & End-to-End Testing
1. **Loan Workflow**: 
   - Apply for a loan -> Verify Guarantor approval -> Disburse -> Repay via M-Pesa.
2. **ROSCA Workflow**: 
   - Create a cycle -> Add members -> Make a round contribution -> Process automated payout.
3. **M-Pesa Reconciliation**:
   - Test the STK push and verify the callback endpoint (`/api/v1/mpesa/callback`) correctly updates the sequence `mpesa_transactions`.

### Phase 4: Database Sequence & Schema Fixes
The Spring Boot startup logs highlighted a few SQL grammar issues that need fixing:
- `ALTER TABLE welfare_funds ADD COLUMN IF NOT EXISTS version bigint DEFAULT 0` (Failing)
- `SELECT setval(pg_get_serial_sequence('chama_members', 'member_id')...` (Failing)
- **Fix**: Update the `data.sql` or Hibernate initialization scripts to handle PostgreSQL specific sequences correctly.
