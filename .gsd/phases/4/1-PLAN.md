# Plan 4.1: Security Hardening & Verification Audit

Consolidate security infrastructure and perform a final production-readiness audit.

## Tasks
- [ ] **Consolidate Rate Limiting**
  - Unify `middleware/security.js` and `middleware/rateLimiting.js`.
  - Ensure `enhancedRateLimiting.js` (email-based) is primary for Auth.
- [ ] **Standardize Security Headers**
  - Merge `helmet` configurations into a single robust policy in `middleware/security.js`.
  - Remove redundant `securityHeaders` functions.
- [ ] **Input Sanitization**
  - Unify `inputValidation` and `suspiciousActivityDetection`.
  - Ensure all POST/PUT routes use the consolidated sanitizer.
- [ ] **Final Verification Audit**
  - Run all created tests (`validationSync.test.js`, `authConsolidation.test.js`).
  - Perform manual audit of critical ROSCA logic endpoints.

## Verification
- PASS on all automated tests.
- Security scan (simplified) of headers via standard requests.
