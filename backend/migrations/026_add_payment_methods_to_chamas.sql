-- Migration: 026_add_payment_methods_to_chamas.sql
-- Purpose: Add flexible payment_methods JSONB column to support Paybill, Till, and Pochi la Biashara
-- Author: Antigravity

BEGIN;

-- 1. Add payment_methods JSONB column
ALTER TABLE IF EXISTS chamas 
ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '{}'::jsonb;

-- 2. Optional: Migrate existing mpesa_paybill if it existed in some version (it wasn't in public schema)
-- Since it wasn't there, we just initialize.

COMMENT ON COLUMN chamas.payment_methods IS 'Stores payment details like { "type": "PAYBILL", "businessNumber": "...", "accountNumber": "..." } or { "type": "TILL", "tillNumber": "..." }';

COMMIT;
