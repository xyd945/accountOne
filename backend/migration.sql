-- Add missing columns to journal_entries table
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
CHECK (source IN ('manual', 'ai_chat', 'ai_transaction', 'api'));

-- Create index for user_id
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);

-- Update existing entries to populate user_id from transaction.user_id
UPDATE journal_entries 
SET user_id = t.user_id,
    source = 'ai_transaction'
FROM transactions t 
WHERE journal_entries.transaction_id = t.id 
AND journal_entries.user_id IS NULL; 