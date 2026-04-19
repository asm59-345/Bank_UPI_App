// ═══════════════════════════════════════════════════════
//  Account Store — Zustand
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import type { Account } from '@/types/account.types';
import { accountService } from '@/services/account.service';

interface AccountState {
  accounts: Account[];
  activeAccount: Account | null;
  balance: number;
  isLoading: boolean;

  fetchAccounts: () => Promise<void>;
  fetchBalance: (accountId: string) => Promise<void>;
  createAccount: () => Promise<void>;
  setActiveAccount: (account: Account) => void;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccount: null,
  balance: 0,
  isLoading: false,

  fetchAccounts: async () => {
    set({ isLoading: true });
    try {
      const accounts = await accountService.getAccounts();
      const activeAccount = accounts.find(a => a.status === 'ACTIVE') || accounts[0] || null;
      set({ accounts, activeAccount, isLoading: false });

      // Auto-fetch balance for active account
      if (activeAccount) {
        get().fetchBalance(activeAccount._id);
      }
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchBalance: async (accountId: string) => {
    try {
      const balance = await accountService.getBalance(accountId);
      set({ balance });
    } catch {
      set({ balance: 0 });
    }
  },

  createAccount: async () => {
    set({ isLoading: true });
    try {
      const account = await accountService.createAccount();
      set(state => ({
        accounts: [...state.accounts, account],
        activeAccount: state.activeAccount || account,
        isLoading: false,
      }));
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  setActiveAccount: (account: Account) => {
    set({ activeAccount: account });
    get().fetchBalance(account._id);
  },
}));
