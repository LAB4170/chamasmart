# ROADMAP.md

> **Current Phase**: Not started
> **Milestone**: v1.1 - ROSCA & Schema Stability

## Must-Haves (from SPEC)
- [ ] Corrected ROSCA Payout Logic
- [ ] Synchronized Validation Schemas
- [ ] Trust Score Integration fix
- [ ] Redundant Auth Controller Removal

## Phases

### Phase 1: ROSCA Logic Stabilization
**Status**: ✅ Complete
**Objective**: Fix critical bugs in payout eligibility and trust score querying.
**Requirements**: REQ-01, REQ-02, REQ-03

### Phase 2: Schema & Validation Sync
**Status**: 🚧 In Progress
**Objective**: Update all Joi schemas and ensure they match controller logic across the project.
**Requirements**: REQ-04

### Phase 3: Technical Debt & Cleanup
**Status**: ⬜ Not Started
**Objective**: Consolidate authentication controllers and clean up redundant backup files.
**Requirements**: REQ-05

### Phase 4: Verification & Hardening
**Status**: ✅ Complete
**Objective**: Perform empirical validation of the full ROSCA cycle and ensure concurrency stability.
**Requirements**: REQ-06, REQ-07
