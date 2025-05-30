-- Add user_id, metadata, source columns to journal_entries
-- Also add transaction_date to record when the business event actually happened

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMPTZ DEFAULT NOW();

-- Update existing entries to have user_id from transaction if available
UPDATE journal_entries 
SET user_id = t.user_id,
    transaction_date = t.created_at
FROM transactions t 
WHERE journal_entries.transaction_id = t.id 
AND journal_entries.user_id IS NULL;

-- Set default transaction_date for entries without transactions
UPDATE journal_entries 
SET transaction_date = created_at 
WHERE transaction_date IS NULL; 