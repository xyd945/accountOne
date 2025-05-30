const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addUserIdToJournalEntries() {
  console.log('🔧 Adding user_id, metadata, and source columns to journal_entries table...');

  try {
    // Add user_id column
    const { error: userIdError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE journal_entries 
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      `
    });

    if (userIdError) {
      console.error('Error adding user_id column:', userIdError);
    } else {
      console.log('✅ Added user_id column');
    }

    // Add metadata column
    const { error: metadataError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE journal_entries 
        ADD COLUMN IF NOT EXISTS metadata JSONB;
      `
    });

    if (metadataError) {
      console.error('Error adding metadata column:', metadataError);
    } else {
      console.log('✅ Added metadata column');
    }

    // Add source column
    const { error: sourceError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE journal_entries 
        ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
        CHECK (source IN ('manual', 'ai_chat', 'ai_transaction', 'api'));
      `
    });

    if (sourceError) {
      console.error('Error adding source column:', sourceError);
    } else {
      console.log('✅ Added source column');
    }

    // Create index for user_id
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
      `
    });

    if (indexError) {
      console.error('Error creating user_id index:', indexError);
    } else {
      console.log('✅ Created user_id index');
    }

    // Update existing entries to populate user_id from transaction.user_id
    console.log('🔄 Populating user_id for existing entries...');
    
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE journal_entries 
        SET user_id = t.user_id,
            source = 'ai_transaction'
        FROM transactions t 
        WHERE journal_entries.transaction_id = t.id 
        AND journal_entries.user_id IS NULL;
      `
    });

    if (updateError) {
      console.error('Error updating existing entries:', updateError);
    } else {
      console.log('✅ Updated existing entries with user_id');
    }

    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  addUserIdToJournalEntries()
    .then(() => {
      console.log('✅ Database migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { addUserIdToJournalEntries }; 