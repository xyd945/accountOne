import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { supabase } from './supabase';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !session) {
            // Redirect to login
            window.location.href = '/auth/login';
            return Promise.reject(error);
          }
          
          // Retry the original request with new token
          const originalRequest = error.config;
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return this.client.request(originalRequest);
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Transaction methods
  async processTransaction(txid: string, description?: string) {
    const response = await this.client.post('/api/transactions', {
      txid,
      description,
    });
    return response.data;
  }

  async getTransactions(params?: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'processed' | 'failed';
  }) {
    const response = await this.client.get('/api/transactions', { params });
    return response.data;
  }

  async getTransaction(id: string) {
    const response = await this.client.get(`/api/transactions/${id}`);
    return response.data;
  }

  async updateJournalEntry(
    transactionId: string,
    entryId: string,
    updates: {
      account_debit?: string;
      account_credit?: string;
      amount?: number;
      narrative?: string;
      is_reviewed?: boolean;
    }
  ) {
    const response = await this.client.put(
      `/api/transactions/${transactionId}/journal-entries/${entryId}`,
      updates
    );
    return response.data;
  }

  // Report methods
  async getBalanceSheet(date: string, currency?: string) {
    const response = await this.client.get('/api/reports/balance-sheet', {
      params: { date, currency },
    });
    return response.data;
  }

  async getCashFlow(start: string, end: string, currency?: string) {
    const response = await this.client.get('/api/reports/cash-flow', {
      params: { start, end, currency },
    });
    return response.data;
  }

  async getJournalEntries(params?: {
    start?: string;
    end?: string;
    account?: string;
    currency?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/api/reports/journal-entries', { params });
    return response.data;
  }

  // Generic request method
  async request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request(config);
    return response.data;
  }

  // AI methods
  async sendChatMessage(message: string, context?: Record<string, unknown>) {
    const response = await this.client.post('/api/ai/chat', {
      message,
      context,
    });
    return response.data;
  }

  async analyzeTransaction(transactionData: Record<string, unknown>, description?: string) {
    const response = await this.client.post('/api/ai/analyze-transaction', {
      transactionData,
      description,
    });
    return response.data;
  }

  async verifyJournalEntry(journalEntry: Record<string, unknown>, originalTransaction?: Record<string, unknown>) {
    const response = await this.client.post('/api/ai/verify-entry', {
      journalEntry,
      originalTransaction,
    });
    return response.data;
  }

  async getAIHealth() {
    const response = await this.client.get('/api/ai/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();

// Type definitions
export interface Transaction {
  id: string;
  user_id: string;
  txid: string;
  description: string | null;
  blockchain_data: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
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
}

export interface BalanceSheetItem {
  account: string;
  balance: number;
  currency: string;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: BalanceSheetItem[];
  liabilities: BalanceSheetItem[];
  equity: BalanceSheetItem[];
  totals: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

export interface CashFlowItem {
  date: string;
  account: string;
  amount: number;
  currency: string;
  narrative: string;
}

export interface CashFlow {
  period: {
    start: string;
    end: string;
  };
  operating: CashFlowItem[];
  investing: CashFlowItem[];
  financing: CashFlowItem[];
  summary: {
    netOperating: number;
    netInvesting: number;
    netFinancing: number;
    netCashFlow: number;
  };
}

// AI-related types
export interface ChatResponse {
  success: boolean;
  data: {
    response: string;
    thinking?: string;
    suggestions: string[];
    journalEntries?: unknown[];
    savedEntries?: unknown[];
    message?: string;
    warning?: string;
  };
  error?: string;
}

export interface JournalEntryVerification {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  reasoning: string;
  ifrsCompliance: string;
}

export interface VerifiedJournalEntry {
  accountDebit: string;
  accountCredit: string;
  amount: number;
  currency: string;
  description: string;
  entryDate: string;
  verification: JournalEntryVerification;
}

export interface TransactionAnalysisResponse {
  journalEntries: VerifiedJournalEntry[];
  summary: {
    totalEntries: number;
    validEntries: number;
    averageConfidence: number;
  };
  timestamp: string;
}

export interface AIHealthResponse {
  gemini: boolean;
  deepseek: boolean;
  overall: boolean;
  capabilities: Record<string, boolean>;
  providers: {
    gemini: {
      available: boolean;
      capabilities: string[];
    };
    deepseek: {
      available: boolean;
      capabilities: string[];
    };
  };
  timestamp: string;
} 