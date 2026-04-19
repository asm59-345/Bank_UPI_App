// ═══════════════════════════════════════════════════════
//  TypeScript Types — Account
// ═══════════════════════════════════════════════════════

export interface Account {
  _id: string;
  user: string;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceResponse {
  balance: number;
  accountId: string;
}
