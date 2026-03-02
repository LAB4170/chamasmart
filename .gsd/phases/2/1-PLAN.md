# Plan 2.1: ROSCA Schema Synchronization

Update ROSCA validation schemas to match snake_case naming and include missing required fields extracted by the controller.

## Tasks
- [ ] Update `createCycleSchema`
  - add `chama_id`, `cycle_name`, `frequency`, `roster_method`, `manual_roster`
  - rename `contributionAmount` to `contribution_amount`
  - rename `startDate` to `start_date`
- [ ] Update `processPayoutSchema`
  - rename `memberId` to `position` (integer)
  - add `payment_proof` (string, max 512, optional)
  - add `reference_id` (string, optional)
  - remove `amount`, `notes` (not used by controller)
- [ ] Update `requestPositionSwapSchema`
  - rename `requestedPosition` to `target_position`
  - remove `currentPosition` (extracted from user session)
- [ ] Update `respondToSwapRequestSchema`
  - rename `status` to `action`
  - restrict `action` to `APPROVED`, `REJECTED` (matching controller check)

## Verification
- Run regression tests for ROSCA cycle creation
- Mock invalid requests and ensure 400 Bad Request
