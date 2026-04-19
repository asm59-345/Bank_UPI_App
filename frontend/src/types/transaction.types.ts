// ═══════════════════════════════════════════════════════
//  TypeScript Types — Transaction & UPI
// ═══════════════════════════════════════════════════════

export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Transaction {
  _id: string;
  fromAccount: string | { _id: string; user: string };
  toAccount: string | { _id: string; user: string };
  amount: number;
  status: TransactionStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  fromAccount: string;
  toAccount: string;
  amount: number;
  idempotencyKey: string;
}

// ─── UPI Payment Types ───

export interface PayP2PRequest {
  senderVpa: string;
  receiverVpa: string;
  amount: number;
  upiPin: string;
  note?: string;
}

export interface PayMerchantRequest {
  senderVpa: string;
  merchantVpa: string;
  amount: number;
  upiPin: string;
  note?: string;
}

export interface CollectRequest {
  requesterVpa: string;
  payerVpa: string;
  amount: number;
  note?: string;
}

export interface CollectResponse {
  action: 'APPROVE' | 'DECLINE';
  upiPin?: string;
}

export interface RefundRequest {
  transactionId: string;
  reason: string;
}

export interface TransactionQuery {
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  type?: string;
}

// ─── UPI ID / VPA Types ───

export interface UpiId {
  _id: string;
  vpa: string;
  displayName: string;
  isDefault: boolean;
  isActive: boolean;
  account: string;
  createdAt: string;
}

export interface CreateUpiIdRequest {
  username: string;
  accountId: string;
  bankHandle?: string;
  displayName?: string;
}

export interface ResolvedVpa {
  vpa: string;
  displayName: string;
}

// ─── Bank Account Types ───

export interface BankAccount {
  _id: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  accountType: string;
  isPrimary: boolean;
  isVerified: boolean;
  status: string;
  createdAt: string;
}

export interface LinkBankAccountRequest {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  accountType?: string;
}

// ─── Notification Types ───

export interface Notification {
  _id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}
