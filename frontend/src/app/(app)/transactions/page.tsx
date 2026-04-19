// ═══════════════════════════════════════════════════════
//  Transaction History Page
// ═══════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, TrendingUp, TrendingDown, Filter,
  RotateCcw, Search,
} from 'lucide-react';
import { upiService } from '@/services/upi.service';
import { useAccountStore } from '@/stores/useAccountStore';
import { StatusBadge } from '@/components/ui/Badge';
import { TransactionListSkeleton } from '@/components/ui/Loader';
import { formatAmount, formatRelativeDate, formatTime } from '@/lib/utils';
import type { Transaction, TransactionStatus } from '@/types/transaction.types';

type FilterType = 'ALL' | 'SENT' | 'RECEIVED' | 'FAILED';

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Failed', value: 'FAILED' },
];

export default function TransactionsPage() {
  const router = useRouter();
  const { activeAccount } = useAccountStore();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadTransactions = useCallback(async (pageNum = 1, reset = true) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const statusMap: Record<FilterType, TransactionStatus | undefined> = {
        ALL: undefined,
        SENT: undefined,
        RECEIVED: undefined,
        FAILED: 'FAILED',
      };

      const data = await upiService.getTransactionHistory({
        page: pageNum,
        limit: 15,
        status: statusMap[filter],
        type: filter === 'SENT' ? 'DEBIT' : filter === 'RECEIVED' ? 'CREDIT' : undefined,
      });

      const txList: Transaction[] = data.transactions || data || [];
      if (reset) {
        setTransactions(txList);
      } else {
        setTransactions(prev => [...prev, ...txList]);
      }
      setHasMore(txList.length === 15);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    setPage(1);
    loadTransactions(1, true);
  }, [filter, loadTransactions]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadTransactions(next, false);
  };

  // ── Group transactions by date ──
  const groupedTransactions = transactions
    .filter(tx => {
      if (!search) return true;
      const s = search.toLowerCase();
      return tx._id.toLowerCase().includes(s) ||
        tx.amount.toString().includes(s) ||
        tx.status.toLowerCase().includes(s);
    })
    .reduce<Record<string, Transaction[]>>((groups, tx) => {
      const date = formatRelativeDate(tx.createdAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(tx);
      return groups;
    }, {});

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="px-5 pt-14 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
            id="tx-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold text-surface-900 dark:text-white font-display">
            Transactions
          </h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
            id="tx-search"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-5 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                filter === f.value
                  ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
              id={`tx-filter-${f.value.toLowerCase()}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 space-y-5">
        {loading ? (
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-4">
            <TransactionListSkeleton count={8} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
              <Filter className="w-8 h-8 text-surface-400" />
            </div>
            <p className="text-base font-bold text-surface-600 dark:text-surface-300">
              No transactions found
            </p>
            <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">
              {filter !== 'ALL'
                ? `No ${filter.toLowerCase()} transactions`
                : 'Start by sending or requesting money'}
            </p>
          </div>
        ) : (
          <>
            {Object.entries(groupedTransactions).map(([date, txs]) => (
              <div key={date}>
                <p className="text-xs font-bold text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-2">
                  {date}
                </p>
                <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden divide-y divide-surface-50 dark:divide-surface-800/50">
                  {txs.map(tx => (
                    <TxRow key={tx._id} tx={tx} accountId={activeAccount?._id} />
                  ))}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-4 text-sm font-semibold text-primary-500 hover:text-primary-400 flex items-center justify-center gap-2 transition-colors"
                id="tx-load-more"
              >
                {loadingMore ? (
                  <><RotateCcw className="w-4 h-4 animate-spin" /> Loading...</>
                ) : (
                  'Load More'
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TxRow({ tx, accountId }: { tx: Transaction; accountId?: string }) {
  const isSent = typeof tx.fromAccount === 'string'
    ? tx.fromAccount === accountId
    : (tx.fromAccount as { _id: string })?._id === accountId;
  const isCredit = !isSent;

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isCredit ? 'bg-success-500/10' : 'bg-primary-500/10'
      }`}>
        {isCredit
          ? <TrendingDown className="w-4 h-4 text-success-600" />
          : <TrendingUp className="w-4 h-4 text-primary-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
          {isCredit ? 'Money Received' : 'Money Sent'}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusBadge status={tx.status} />
          <span className="text-xs text-surface-400 dark:text-surface-500">
            {formatTime(tx.createdAt)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${
          isCredit ? 'text-success-600 dark:text-success-400' : 'text-surface-800 dark:text-surface-200'
        }`}>
          {isCredit ? '+' : '-'}₹{formatAmount(tx.amount)}
        </p>
      </div>
    </div>
  );
}
