-- Add soft delete columns to contributions table
ALTER TABLE contributions 
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create an index to improve performance of queries filtering non-deleted types
CREATE INDEX idx_contributions_is_deleted ON contributions(is_deleted);
