-- Migration: Make user email and names nullable to support Phone Auth
-- Description: When registering via Firebase Phone Auth, the user only has a phone number.
-- Email, first_name, and last_name must be nullable to allow progressive profiling.

BEGIN;

-- Make email nullable
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Make first_name nullable (will be collected in /complete-profile)
ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;

-- Make last_name nullable (will be collected in /complete-profile)
ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;

-- Since email is no longer guaranteed, we need to ensure the UNIQUE constraint 
-- on email still works but allows multiple NULLs (standard in recent Postgres, 
-- but good to be explicit if there are custom constraints).
-- Assuming the existing constraint is just UNIQUE(email).

COMMIT;
