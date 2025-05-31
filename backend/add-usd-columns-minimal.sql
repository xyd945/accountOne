-- Minimal USD columns migration for journal_entries table
-- Only adds the essential columns needed for USD value storage

-- Add USD value columns (safe - only adds new nullable columns)
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS usd_value NUMERIC(20, 2) NULL,
ADD COLUMN IF NOT EXISTS usd_rate NUMERIC(20, 8) NULL,
ADD COLUMN IF NOT EXISTS usd_source VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS usd_timestamp TIMESTAMPTZ NULL;

-- Add performance indexes (safe - only improves query speed)
CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_value ON journal_entries(usd_value);
CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_source ON journal_entries(usd_source);

-- Add column documentation (safe - only adds comments)
COMMENT ON COLUMN journal_entries.usd_value IS 'USD equivalent of the amount at time of transaction';
COMMENT ON COLUMN journal_entries.usd_rate IS 'Exchange rate used to calculate USD value (currency to USD)';
COMMENT ON COLUMN journal_entries.usd_source IS 'Source of exchange rate (FTSO, CoinGecko, Manual, etc.)';
COMMENT ON COLUMN journal_entries.usd_timestamp IS 'Timestamp when the USD rate was fetched'; 