# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.1 - ROSCA & Schema Stability

## Must-Haves (from SPEC)
- [x] Corrected ROSCA Payout Logic
- [x] Synchronized Validation Schemas
- [x] Trust Score Integration fix
- [x] Redundant Auth Controller Removal

## Phases

### Phase 15.2: Backend Stabilization (M-Pesa & Socket)
- **Goal**: Resolve M-Pesa 500/504 timeouts and Socket.io connection refusal issues.
- **Status**: Completed
- **Type**: Stability Improvement

### Phase 15.3: M-Pesa Hardening (Audit Gap Closure)
- **Goal**: Close 4 audit gaps: production safety guard, mock E2E callback, Safaricom 200 contract, Money utility extraction.
- **Status**: Completed
- **Type**: Stability / Correctness

### Phase 16: ROSCA Cycle Management & Ledgers 
- **Goal**: Implement physical backend endpoints for ROSCA cycle contributions and add unified frontend ledger components so members can track their payment history.
- **Status**: Completed
- **Type**: Feature Completion
