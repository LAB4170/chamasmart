# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To transform ChamaSmart into a production-ready, highly reliable financial management platform for investment groups by resolving critical architectural flaws, stabilizing core savings models (ROSCA/ASCA), and enforcing strict financial integrity.

## Goals
1. **Fix Critical Financial Logic**: Resolve the identified ROSCA bugs regarding trust score integration, payout eligibility, and position swaps.
2. **Schema & Validation Synchronization**: Harmonize backend Joi schemas with controller requirements and database constraints to prevent silent failures.
3. **Architecture Stabilization**: Refactor oversized controllers (e.g., `loanController.js`) and resolve technical debt in authentication and error handling.
4. **Empirical Verification**: Implement a robust verification plan to ensure financial transactions (contributions, payouts, loans) are accurate and immutable.

## Non-Goals (Out of Scope)
- Complete UI/UX overhaul (focus is on stability and logic).
- Migration from PostgreSQL to NoSQL or other database types.
- Implementation of new complex investment models beyond stabilizing existing ones.

## Users
- **Chama Officials**: Chairperson, Treasurer, and Secretary who manage cycles, payouts, and membership.
- **Chama Members**: Users who contribute funds, participate in savings cycles, and apply for loans.

## Constraints
- **Technical**: Must maintain compatibility with existing PostgreSQL schema and Firebase Authentication.
- **Security**: Must enforce strict role-based access control (RBAC) as defined in the mapping.
- **Integrity**: All financial transactions must be idempotent and atomic.

## Success Criteria
- [ ] ROSCA "Trust-Based" rosters correctly utilize `chama_members` trust scores.
- [ ] Payout eligibility calculation correctly sums contribution amounts instead of counting rows.
- [ ] All API endpoints have synchronized Joi validation schemas.
- [ ] Critical technical debt items (e.g., `authController.backup.js`) are resolved.
- [ ] Automated tests or empirical evidence confirm correct financial flow for a full ROSCA cycle.

## Phase 14 Goals
- **Visual Loan Analytics**: Build a dedicated, visually impactful dashboard rendering API analytics (Recharts for trends).
- **Functional Exports**: Execute functional PDF and Excel downloads for loan data.

## Phase 15 Goals
- **Treasury Liquidity Guards**: Ensure loans cannot be applied for or approved if the requested amount exceeds the Chama's actual unallocated cash pool (Total Contributions - Active Disbursed Loans).

## Phase 16 Goals (New)
- **ROSCA Contribution Backend**: Create backend endpoints (`makeContribution`, `getContributions`, `getMemberStatement`) to capture real ROSCA payments.
- **ROSCA Payment Ledger**: Build a frontend component to track member payments for the active cycle, replacing the simulated payment flow.

## Phase 30 Goals (New)
- **Real-Time Group Chat**: Implement a WhatsApp-like real-time messaging platform within every Chama for seamless member communication.
- **Media Support**: Support secure photo and video attachments within the chat via resilient cloud storage.
- **AI Customer Service**: Deploy a 24/7 intelligent chatbot integrated into the platform to handle member FAQs, customer service, and platform navigation.
## Phase 35 Goals (New)
- **Automated ROSCA Cashouts**: Disburse funds via M-Pesa B2C immediately upon receiving the final cycle contribution (no Treasurer gate).
- **Table Banking Cash-Locks**: Block physical meeting closure if the cash on the table does not mathematically equal `opening + contributions - loans`.
- **Developer Operations**: Restore the Jest test suite to a 100% pass rate by rewriting outdated Auth & RBAC mocks, and format the entire codebase to silence 28,000 OS line-break lint warnings.
