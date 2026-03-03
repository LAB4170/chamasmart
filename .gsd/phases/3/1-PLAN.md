# Plan 3.1: Auth Consolidation and Cleanup

Unify the authentication logic and clean up redundant backup/versioned files.

## Tasks
- [ ] **Consolidate Auth Controller**
  - Verify `backend/controllers/authController.js` has all features from `authController.backup.js`.
  - Delete `backend/controllers/authController.backup.js`.
- [ ] **Unify Auth Routes**
  - Update `backend/routes/auth.js`:
    - Fix imports to use `registerPasswordSchema`, `loginPasswordSchema` from `validationSchemas.js`.
    - Apply `applyAuthRateLimiting` middleware.
    - Ensure all endpoints match production requirements.
  - Fix `backend/routes/authV2.js` or redirect in `server.js`.
  - Delete `backend/routes/auth.backup.js`.
- [ ] **Server cleanup**
  - Standardize error handling and logging in `server.js`.

## Verification
- Test all auth endpoints (Register, Login, Refresh, Logout) via standalone scripts.
- Ensure 429 status is returned for rate-limited requests.
