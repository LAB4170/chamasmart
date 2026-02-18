-- Add constitution_config column to chamas table
ALTER TABLE chamas ADD COLUMN IF NOT EXISTS constitution_config JSONB DEFAULT '{}'::jsonb;

-- Create index for faster querying of JSON data if needed (optional but good for future filtering)
CREATE INDEX IF NOT EXISTS idx_chamas_constitution ON chamas USING gin (constitution_config);

-- Add 'PENALTY' to transaction types/descriptions if strict typing is used elsewhere (checking transactions table logic later)
-- For now, just ensuring the column exists is key.
