// ═══════════════════════════════════════════════════════
//  Account Service — Accounts + Balance
// ═══════════════════════════════════════════════════════

import api from '@/lib/api';
import type { Account } from '@/types/account.types';

export const accountService = {
  /**
   * POST /api/accounts/
   * Create a new account
   */
  createAccount: async (): Promise<Account> => {
    const response = await api.post<Account>('/accounts');
    return response.data;
  },

  /**
   * GET /api/accounts/
   * Get all accounts of the logged-in user
   */
  getAccounts: async (): Promise<Account[]> => {
    const response = await api.get('/accounts');
    // API may return { accounts: [...] } or direct array
    return response.data.accounts || response.data;
  },

  /**
   * GET /api/accounts/balance/:accountId
   * Get balance for a specific account
   */
  getBalance: async (accountId: string): Promise<number> => {
    const response = await api.get(`/accounts/balance/${accountId}`);
    return response.data.balance ?? response.data;
  },
};
