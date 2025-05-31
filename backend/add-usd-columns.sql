-- Add USD value columns to journal_entries table
-- This enables efficient querying and reporting on USD amounts

ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS usd_value NUMERIC(20, 2) NULL,
ADD COLUMN IF NOT EXISTS usd_rate NUMERIC(20, 8) NULL,
ADD COLUMN IF NOT EXISTS usd_source VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS usd_timestamp TIMESTAMPTZ NULL;

-- Add indexes for USD columns for better query performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_value ON journal_entries(usd_value);
CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_source ON journal_entries(usd_source);
CREATE INDEX IF NOT EXISTS idx_journal_entries_usd_timestamp ON journal_entries(usd_timestamp);

-- Add comments to document the USD columns
COMMENT ON COLUMN journal_entries.usd_value IS 'USD equivalent of the amount at time of transaction';
COMMENT ON COLUMN journal_entries.usd_rate IS 'Exchange rate used to calculate USD value (currency to USD)';
COMMENT ON COLUMN journal_entries.usd_source IS 'Source of exchange rate (FTSO, CoinGecko, Manual, etc.)';
COMMENT ON COLUMN journal_entries.usd_timestamp IS 'Timestamp when the USD rate was fetched';

-- Create a view for easy USD reporting
CREATE OR REPLACE VIEW journal_entries_with_usd AS
SELECT 
  j.*,
  CASE 
    WHEN j.usd_value IS NOT NULL THEN j.usd_value
    WHEN j.currency = 'USD' THEN j.amount
    ELSE NULL
  END AS effective_usd_value,
  CASE 
    WHEN j.usd_value IS NOT NULL THEN CONCAT('$', TO_CHAR(j.usd_value, 'FM999,999,999,990.00'))
    WHEN j.currency = 'USD' THEN CONCAT('$', TO_CHAR(j.amount, 'FM999,999,999,990.00'))
    ELSE NULL
  END AS formatted_usd_value
FROM journal_entries j;

-- Create a summary function for USD totals
CREATE OR REPLACE FUNCTION get_usd_summary(
  user_id_param UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_usd_value NUMERIC(20, 2),
  total_entries INTEGER,
  enhanced_entries INTEGER,
  enhancement_rate NUMERIC(5, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(j.usd_value), 0) as total_usd_value,
    COUNT(*)::INTEGER as total_entries,
    COUNT(j.usd_value)::INTEGER as enhanced_entries,
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(j.usd_value)::NUMERIC / COUNT(*)::NUMERIC * 100)
      ELSE 0
    END as enhancement_rate
  FROM journal_entries j
  WHERE j.user_id = user_id_param
    AND (start_date IS NULL OR j.entry_date >= start_date)
    AND (end_date IS NULL OR j.entry_date <= end_date);
END;
$$ LANGUAGE plpgsql; 