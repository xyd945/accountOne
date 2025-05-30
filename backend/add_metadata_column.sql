-- Add metadata column to journal_entries table
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add an index for better performance on metadata queries
CREATE INDEX IF NOT EXISTS idx_journal_entries_metadata 
ON journal_entries USING GIN (metadata);

-- Add source column if it doesn't exist
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'; 