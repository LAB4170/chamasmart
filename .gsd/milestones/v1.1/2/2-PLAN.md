# Plan 2.2: Chama & Contribution Schema Synchronization

Align Chama and Contribution schemas with controller and database requirements.

## Tasks
- [ ] Update `createChamaSchema`
  - add `visibility` (valid: PUBLIC, PRIVATE)
  - add `paymentMethods` (object)
  - Ensure all fields are required as per controller check
- [ ] Update `updateChamaSchema`
  - add `visibility`, `constitution_config`, `paymentMethods`
- [ ] Review `contributionSchema`
  - Ensure compatibility with both standalone and ROSCA-linked contributions

## Verification
- Test Chama creation with visibility and payment methods
- Verify that invalid payment method types are rejected
