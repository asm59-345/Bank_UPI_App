// ═══════════════════════════════════════════════════════
//  Transaction Service — Create + List Transactions
// ═══════════════════════════════════════════════════════

import api from '@/lib/api';
import type {
  Transaction,
  CreateTransactionRequest,
} from '@/types/transaction.types';

export const transactionService = {
  /**
   * POST /api/transactions/
   * Create a new transaction
   */
  createTransaction: async (data: CreateTransactionRequest): Promise<Transaction> => {
    const response = await api.post<Transaction>('/transactions', data);
    return response.data;
  },

  /**
   * GET /api/transactions/ (via UPI route for history)
   * The backend exposes transaction history via /api/upi/transactions
   */
  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<{ transactions: Transaction[]; total: number; page: number }> => {
    const response = await api.get('/upi/transactions', { params });
    return response.data.data || response.data;
  },
};
