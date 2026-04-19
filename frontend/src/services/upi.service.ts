// ═══════════════════════════════════════════════════════
//  UPI Service — Payments, Collect, VPA Management
// ═══════════════════════════════════════════════════════

import api from '@/lib/api';
import type {
  PayP2PRequest,
  CollectRequest,
  CollectResponse,
  TransactionQuery,
  UpiId,
  CreateUpiIdRequest,
  ResolvedVpa,
  BankAccount,
  LinkBankAccountRequest,
} from '@/types/transaction.types';

export const upiService = {
  // ─── UPI Payments ───

  payP2P: async (data: PayP2PRequest) => {
    const response = await api.post('/upi/pay', data);
    return response.data;
  },

  createCollect: async (data: CollectRequest) => {
    const response = await api.post('/upi/collect', data);
    return response.data;
  },

  respondToCollect: async (requestId: string, data: CollectResponse) => {
    const response = await api.post(`/upi/collect/${requestId}/respond`, data);
    return response.data;
  },

  getPendingCollects: async () => {
    const response = await api.get('/upi/collect/pending');
    return response.data.data || response.data;
  },

  getTransactionHistory: async (params?: TransactionQuery) => {
    const response = await api.get('/upi/transactions', { params });
    return response.data.data || response.data;
  },

  refundTransaction: async (transactionId: string, reason: string) => {
    const response = await api.post('/upi/refund', { transactionId, reason });
    return response.data;
  },

  // ─── UPI ID (VPA) Management ───

  createUpiId: async (data: CreateUpiIdRequest): Promise<UpiId> => {
    const response = await api.post<UpiId>('/upi-id', data);
    return response.data;
  },

  listUpiIds: async (): Promise<UpiId[]> => {
    const response = await api.get('/upi-id');
    return response.data.data || response.data;
  },

  resolveVpa: async (vpa: string): Promise<ResolvedVpa> => {
    const response = await api.get<ResolvedVpa>(`/upi-id/resolve/${vpa}`);
    return response.data;
  },

  deactivateUpiId: async (vpa: string) => {
    const response = await api.delete(`/upi-id/${vpa}`);
    return response.data;
  },

  setDefaultUpiId: async (vpa: string) => {
    const response = await api.put(`/upi-id/${vpa}/default`);
    return response.data;
  },

  // ─── Bank Account Management ───

  linkBankAccount: async (data: LinkBankAccountRequest): Promise<BankAccount> => {
    const response = await api.post<BankAccount>('/bank-accounts/link', data);
    return response.data;
  },

  listBankAccounts: async (): Promise<BankAccount[]> => {
    const response = await api.get('/bank-accounts');
    return response.data.data || response.data;
  },

  verifyBankAccount: async (id: string) => {
    const response = await api.post(`/bank-accounts/${id}/verify`);
    return response.data;
  },

  unlinkBankAccount: async (id: string) => {
    const response = await api.delete(`/bank-accounts/${id}`);
    return response.data;
  },

  setPrimaryAccount: async (id: string) => {
    const response = await api.put(`/bank-accounts/${id}/primary`);
    return response.data;
  },

  setUpiPin: async (id: string, data: { newPin: string; currentPin?: string }) => {
    const response = await api.post(`/bank-accounts/${id}/set-pin`, data);
    return response.data;
  },
};
