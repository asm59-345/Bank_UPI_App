// ═══════════════════════════════════════════════════════
//  Request Money Page — Collect Flow
// ═══════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, IndianRupee, Check, X, Clock,
  ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { upiService } from '@/services/upi.service';
import { useToast } from '@/hooks/useToast';
import { isValidVpa, formatRelativeDate } from '@/lib/utils';

interface CollectRequest {
  _id: string;
  requesterVpa: string;
  payerVpa: string;
  amount: number;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'EXPIRED';
  createdAt: string;
}

export default function RequestMoneyPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [tab, setTab] = useState<'request' | 'pending'>('request');
  const [payerVpa, setPayerVpa] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<CollectRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');

  const loadPendingRequests = useCallback(async () => {
    setPendingLoading(true);
    try {
      const data = await upiService.getPendingCollects();
      setPendingRequests(data.collectRequests || data || []);
    } catch {
      // Silent fail
    } finally {
      setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!payerVpa.trim()) e.payerVpa = 'Enter the payer UPI ID';
    else if (!isValidVpa(payerVpa.trim())) e.payerVpa = 'Invalid UPI ID format';
    const amt = parseFloat(amount);
    if (!amount) e.amount = 'Enter amount';
    else if (isNaN(amt) || amt < 1) e.amount = 'Minimum ₹1';
    else if (amt > 100000) e.amount = 'Maximum ₹1,00,000';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRequest = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const vpas = await upiService.listUpiIds();
      const myVpa = vpas.find(v => v.isDefault) || vpas[0];
      if (!myVpa) {
        addToast('Please create a UPI ID first in Profile', 'error');
        return;
      }
      await upiService.createCollect({
        requesterVpa: myVpa.vpa,
        payerVpa: payerVpa.trim(),
        amount: parseFloat(amount),
        note: note || undefined,
      });
      setSuccess(true);
      addToast('Request sent successfully!', 'success');
      loadPendingRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send request';
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId: string, action: 'APPROVE' | 'DECLINE') => {
    if (action === 'APPROVE' && pinInput.length < 4) {
      addToast('Enter your UPI PIN to approve', 'error');
      return;
    }
    setRespondingId(requestId);
    try {
      await upiService.respondToCollect(requestId, {
        action,
        upiPin: action === 'APPROVE' ? pinInput : undefined,
      });
      addToast(action === 'APPROVE' ? 'Payment approved!' : 'Request declined', 'success');
      setPinInput('');
      setExpandedId(null);
      loadPendingRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      addToast(message, 'error');
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
          id="request-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-surface-900 dark:text-white font-display">
          Request Money
        </h1>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-5">
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800/50 p-1 rounded-2xl">
          {(['request', 'pending'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 capitalize relative ${
                tab === t
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
              id={`request-tab-${t}`}
            >
              {t === 'pending' && pendingRequests.length > 0 && (
                <span className="absolute top-1.5 right-2 w-2 h-2 bg-danger-500 rounded-full" />
              )}
              {t === 'request' ? 'Request' : `Pending (${pendingRequests.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {/* ── Request Tab ── */}
        {tab === 'request' && !success && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white dark:bg-surface-900 rounded-2xl p-5 space-y-4">
              <p className="text-sm font-semibold text-surface-600 dark:text-surface-300">
                Who should pay?
              </p>
              <Input
                label="Payer UPI ID"
                type="text"
                placeholder="name@upi"
                value={payerVpa}
                onChange={e => { setPayerVpa(e.target.value); setErrors(p => ({ ...p, payerVpa: '' })); }}
                error={errors.payerVpa}
                autoCapitalize="none"
                id="request-vpa-input"
              />
              <Input
                label="Amount (₹)"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: '' })); }}
                error={errors.amount}
                icon={<IndianRupee className="w-4 h-4" />}
                inputMode="decimal"
                id="request-amount-input"
              />
              <Input
                label="Note (optional)"
                type="text"
                placeholder="What is this for?"
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={50}
                id="request-note-input"
              />
              <Button
                fullWidth
                size="lg"
                onClick={handleRequest}
                isLoading={loading}
                id="request-send-btn"
              >
                Send Request
              </Button>
            </div>
          </div>
        )}

        {/* ── Success State ── */}
        {tab === 'request' && success && (
          <div className="flex flex-col items-center py-12 space-y-6 animate-scale-in">
            <div className="w-24 h-24 rounded-full bg-success-500/10 flex items-center justify-center">
              <Check className="w-12 h-12 text-success-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-surface-900 dark:text-white font-display">
                Request Sent!
              </h2>
              <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
                ₹{parseFloat(amount).toLocaleString('en-IN')} requested from {payerVpa}
              </p>
            </div>
            <div className="w-full space-y-3">
              <Button fullWidth onClick={() => { setSuccess(false); setPayerVpa(''); setAmount(''); setNote(''); }} id="request-again-btn">
                Request Again
              </Button>
              <Button fullWidth variant="secondary" onClick={() => setTab('pending')} id="view-pending-btn">
                View Pending Requests
              </Button>
            </div>
          </div>
        )}

        {/* ── Pending Tab ── */}
        {tab === 'pending' && (
          <div className="space-y-3 animate-slide-up">
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400 font-medium">Incoming payment requests</p>
              <button
                onClick={loadPendingRequests}
                className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 transition-colors"
                id="refresh-pending-btn"
              >
                <RefreshCw className={`w-4 h-4 ${pendingLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {pendingLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-20 rounded-2xl bg-surface-200 dark:bg-surface-800 animate-pulse" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Clock className="w-12 h-12 text-surface-300 dark:text-surface-600 mb-3" />
                <p className="text-sm font-semibold text-surface-500 dark:text-surface-400">
                  No pending requests
                </p>
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                  Requests others send you will appear here
                </p>
              </div>
            ) : (
              pendingRequests.map(req => (
                <div
                  key={req._id}
                  className="bg-white dark:bg-surface-900 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-surface-800 dark:text-white text-sm">
                        {req.requesterVpa}
                      </p>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {formatRelativeDate(req.createdAt)}
                        {req.note && ` · ${req.note}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-surface-900 dark:text-white">
                        ₹{req.amount.toLocaleString('en-IN')}
                      </p>
                      <StatusBadge status={req.status} />
                    </div>
                  </div>

                  {req.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => setExpandedId(expandedId === req._id ? null : req._id)}
                        className="text-xs text-primary-500 flex items-center gap-1"
                      >
                        {expandedId === req._id ? 'Hide' : 'Show'} options
                        {expandedId === req._id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {expandedId === req._id && (
                        <div className="space-y-3 pt-1 animate-slide-up">
                          <Input
                            type="password"
                            placeholder="Enter UPI PIN to approve"
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value)}
                            icon={<span className="text-xs text-surface-400">PIN</span>}
                            maxLength={6}
                            inputMode="numeric"
                            id={`pin-${req._id}`}
                          />
                          <div className="flex gap-2">
                            <Button
                              fullWidth
                              size="sm"
                              onClick={() => handleRespond(req._id, 'APPROVE')}
                              isLoading={respondingId === req._id}
                              id={`approve-${req._id}`}
                            >
                              <Check className="w-4 h-4" /> Pay
                            </Button>
                            <Button
                              fullWidth
                              size="sm"
                              variant="danger"
                              onClick={() => handleRespond(req._id, 'DECLINE')}
                              isLoading={respondingId === req._id}
                              id={`decline-${req._id}`}
                            >
                              <X className="w-4 h-4" /> Decline
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
