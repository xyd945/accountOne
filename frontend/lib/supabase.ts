import { createBrowserClient } from '@supabase/ssr'

// Provide fallback values for build time when env vars might not be available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          txid: string;
          description: string | null;
          blockchain_data: Record<string, unknown>;
          status: 'pending' | 'processed' | 'failed';
          fetched_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          txid: string;
          description?: string | null;
          blockchain_data?: Record<string, unknown>;
          status?: 'pending' | 'processed' | 'failed';
          fetched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          txid?: string;
          description?: string | null;
          blockchain_data?: Record<string, unknown>;
          status?: 'pending' | 'processed' | 'failed';
          fetched_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      journal_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account_debit: string;
          account_credit: string;
          amount: number;
          currency: string;
          entry_date: string;
          narrative: string | null;
          ai_confidence: number | null;
          is_reviewed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          account_debit: string;
          account_credit: string;
          amount: number;
          currency: string;
          entry_date: string;
          narrative?: string | null;
          ai_confidence?: number | null;
          is_reviewed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          account_debit?: string;
          account_credit?: string;
          amount?: number;
          currency?: string;
          entry_date?: string;
          narrative?: string | null;
          ai_confidence?: number | null;
          is_reviewed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}; 