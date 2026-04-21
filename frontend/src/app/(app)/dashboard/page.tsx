// ═══════════════════════════════════════════════════════
//  Dashboard Page
// ═══════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  SendHorizontal, ArrowDownLeft, QrCode, Bell,
  Sun, Moon, TrendingUp, TrendingDown, RefreshCw,
  ChevronRight, Zap, ShieldAlert
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { upiService } from '@/services/upi.service';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/components/ThemeProvider';
import { StatusBadge } from '@/components/ui/Badge';
import { BalanceSkeleton, TransactionListSkeleton } from '@/components/ui/Loader';
import { formatAmount, formatRelativeDate, formatTime } from '@/lib/utils';
import type { Transaction } from '@/types/transaction.types';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { accounts, activeAccount, balance, fetchBalance, isLoading: accountLoading } = useAccountStore();
  const { addToast } = useToast();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(async () => {
    try {
      const data = await upiService.getTransactionHistory({ limit: 5 });
      setTransactions(data.transactions || data || []);
    } catch {
      // Silently fail — user may not have transactions yet
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (activeAccount) await fetchBalance(activeAccount._id);
      await loadTransactions();
      addToast('Balance updated', 'success');
    } catch {
      addToast('Failed to refresh', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const quickActions = [
    { icon: SendHorizontal, label: 'Send', href: '/send', color: 'text-primary-500', bg: 'bg-primary-500/10' },
    { icon: ArrowDownLeft, label: 'Request', href: '/request', color: 'text-success-600', bg: 'bg-success-500/10' },
    { icon: QrCode, label: 'Scan QR', href: '/scan', color: 'text-warning-600', bg: 'bg-warning-500/10' },
    { icon: TrendingUp, label: 'History', href: '/transactions', color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { icon: Zap, label: 'AI Insights', href: '/ai-insights', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { icon: ShieldAlert, label: 'Security', href: '/fraud-dashboard', color: 'text-red-500', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 pb-4">
      {/* ── Header ── */}
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-surface-400 dark:text-surface-500">
            {getGreeting()},
          </p>
          <h1 className="text-lg font-bold text-surface-900 dark:text-white font-display">
            {user?.name?.split(' ')[0] ?? 'User'} 👋
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
            id="theme-toggle"
          >
            {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors relative"
            id="notifications-btn"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-danger-500 rounded-full" />
          </button>
        </div>
      </div>

      <div className="px-5 space-y-5">
        {/* ── Balance Card ── */}
        {accountLoading ? (
          <BalanceSkeleton />
        ) : (
          <div className="balance-card relative">
            {/* Orb decorations */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3" />

            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium uppercase tracking-wider">
                    Available Balance
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <div
                      className="cursor-pointer"
                      onClick={() => setBalanceVisible(v => !v)}
                    >
                      {balanceVisible ? (
                        <h2 className="text-4xl font-bold text-white font-display tracking-tight">
                          <span className="text-2xl font-medium">₹</span>
                          {formatAmount(balance)}
                        </h2>
                      ) : (
                        <h2 className="text-4xl font-bold text-white font-display tracking-tight">
                          ₹ ••••••
                        </h2>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  className="p-2 rounded-xl bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
                  id="refresh-balance"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10">
                  <Zap className="w-3.5 h-3.5 text-white/80" />
                  <span className="text-white/80 text-xs font-medium">
                    {accounts.length > 0 ? 'Active' : 'No Account'}
                  </span>
                </div>
                {activeAccount && (
                  <span className="text-white/50 text-xs">
                    {activeAccount.currency} • {activeAccount.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="quick-action group"
                id={`quick-action-${action.label.toLowerCase().replace(' ', '-')}`}
              >
                <div className={`quick-action-icon ${action.bg} ${action.color} group-hover:scale-110 transition-transform duration-200`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-semibold text-surface-600 dark:text-surface-400">
                  {action.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Recent Transactions ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
              Recent Activity
            </h3>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-primary-500 hover:text-primary-400 flex items-center gap-1"
            >
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden divide-y divide-surface-100 dark:divide-surface-800/50">
            {txLoading ? (
              <div className="p-4">
                <TransactionListSkeleton count={4} />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-3">
                  <TrendingUp className="w-7 h-7 text-surface-400" />
                </div>
                <p className="text-sm font-semibold text-surface-500 dark:text-surface-400">
                  No transactions yet
                </p>
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                  Send money to get started
                </p>
              </div>
            ) : (
              transactions.map((tx) => (
                <TransactionItem key={tx._id} tx={tx} accountId={activeAccount?._id} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Transaction Item Component ──
function TransactionItem({ tx, accountId }: { tx: Transaction; accountId?: string }) {
  const isSent = typeof tx.fromAccount === 'string'
    ? tx.fromAccount === accountId
    : tx.fromAccount?._id === accountId;

  const amount = tx.amount;
  const isCredit = !isSent;

  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${
      tx.status === 'COMPLETED' ? (isCredit ? 'tx-completed' : '') : 
      tx.status === 'PENDING' ? 'tx-pending' : 'tx-failed'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isCredit ? 'bg-success-500/10' : 'bg-primary-500/10'
      }`}>
        {isCredit
          ? <TrendingDown className="w-4 h-4 text-success-600" />
          : <TrendingUp className="w-4 h-4 text-primary-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">
          {isCredit ? 'Received' : 'Sent'}
        </p>
        <p className="text-xs text-surface-400 dark:text-surface-500">
          {formatRelativeDate(tx.createdAt)} · {formatTime(tx.createdAt)}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${
          isCredit ? 'text-success-600 dark:text-success-400' : 'text-surface-800 dark:text-surface-200'
        }`}>
          {isCredit ? '+' : '-'}₹{amount.toLocaleString('en-IN')}
        </p>
        <StatusBadge status={tx.status} />
      </div>
    </div>
  );
}
