// ═══════════════════════════════════════════════════════
//  Send Money Page — with QR scan param support
// ═══════════════════════════════════════════════════════
// This is the same as send/page.tsx but reads ?vpa= from URL
// We handle this by adding useSearchParams to prefill VPA from QR scan

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Search, CheckCircle2, AlertCircle,
  IndianRupee, ChevronRight, Lock, QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAccountStore } from '@/stores/useAccountStore';
import { upiService } from '@/services/upi.service';
import { useToast } from '@/hooks/useToast';
import { isValidVpa } from '@/lib/utils';

type Step = 'enter-vpa' | 'enter-amount' | 'enter-pin' | 'success' | 'failure';

interface ReceiverInfo {
  vpa: string;
  displayName: string;
}

function SendMoneyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeAccount } = useAccountStore();
  const { addToast } = useToast();

  const [step, setStep] = useState<Step>('enter-vpa');
  const [vpa, setVpa] = useState('');
  const [vpaError, setVpaError] = useState('');
  const [resolving, setResolving] = useState(false);
  const [receiver, setReceiver] = useState<ReceiverInfo | null>(null);

  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [note, setNote] = useState('');

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-fill VPA from QR scan URL params
  useEffect(() => {
    const qrVpa = searchParams.get('vpa');
    const qrName = searchParams.get('name');
    const qrAmount = searchParams.get('amount');
    if (qrVpa) {
      setVpa(qrVpa);
      if (qrName) {
        // Already resolved from QR — skip vpa step
        setReceiver({ vpa: qrVpa, displayName: decodeURIComponent(qrName) });
        setStep('enter-amount');
      }
      if (qrAmount) setAmount(qrAmount);
    }
  }, [searchParams]);

  // ── Step 1: Resolve VPA ──
  const handleResolveVpa = async () => {
    if (!isValidVpa(vpa.trim())) {
      setVpaError('Enter a valid UPI ID (e.g., name@upi)');
      return;
    }
    setResolving(true);
    setVpaError('');
    try {
      const resolved = await upiService.resolveVpa(vpa.trim());
      setReceiver({ vpa: vpa.trim(), displayName: resolved.displayName });
      setStep('enter-amount');
    } catch {
      setVpaError('UPI ID not found. Please check and try again.');
    } finally {
      setResolving(false);
    }
  };

  // ── Step 2: Validate Amount ──
  const handleAmountNext = () => {
    const val = parseFloat(amount);
    if (!amount || isNaN(val)) { setAmountError('Enter a valid amount'); return; }
    if (val < 1) { setAmountError('Minimum amount is ₹1'); return; }
    if (val > 100000) { setAmountError('Maximum ₹1,00,000 per transaction'); return; }
    setAmountError('');
    setStep('enter-pin');
  };

  // ── Step 3: Send Payment ──
  const handleSend = async () => {
    if (pin.length < 4) { setPinError('Enter your 4–6 digit UPI PIN'); return; }
    if (!activeAccount) { addToast('No active account found', 'error'); return; }
    if (!receiver) return;

    setLoading(true);
    setPinError('');
    try {
      const vpas = await upiService.listUpiIds();
      const defaultVpa = vpas.find(v => v.isDefault) || vpas[0];
      if (!defaultVpa) {
        addToast('Please create a UPI ID first in Profile', 'error');
        setLoading(false);
        return;
      }

      await upiService.payP2P({
        senderVpa: defaultVpa.vpa,
        receiverVpa: receiver.vpa,
        amount: parseFloat(amount),
        upiPin: pin,
        note: note || undefined,
      });

      setStep('success');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Payment failed');
      setStep('failure');
    } finally {
      setLoading(false);
    }
  };

  const numPad = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];
  const handleNumPad = (val: string) => {
    if (val === '⌫') { setAmount(a => a.slice(0, -1)); }
    else if (val === '.' && amount.includes('.')) { return; }
    else {
      const next = amount + val;
      if (next.split('.')[1]?.length > 2) return;
      setAmount(next);
    }
    setAmountError('');
  };

  const goBack = () => {
    if (step === 'enter-vpa') { router.back(); return; }
    const prevMap: Partial<Record<Step,Step>> = { 'enter-amount': 'enter-vpa', 'enter-pin': 'enter-amount' };
    setStep(prev => prevMap[prev] ?? 'enter-vpa');
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4">
        <button onClick={goBack} className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400" id="send-back-btn">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-surface-900 dark:text-white font-display">Send Money</h1>
          <p className="text-xs text-surface-400">
            {step === 'enter-vpa' && 'Enter recipient UPI ID'}
            {step === 'enter-amount' && `To: ${receiver?.displayName}`}
            {step === 'enter-pin' && 'Confirm with UPI PIN'}
          </p>
        </div>
        {step === 'enter-vpa' && (
          <button onClick={() => router.push('/scan')} className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500" id="send-scan-qr-btn">
            <QrCode className="w-4 h-4" />
          </button>
        )}
      </div>

      {!['success', 'failure'].includes(step) && (
        <div className="px-5 mb-5">
          <div className="flex gap-1.5">
            {(['enter-vpa', 'enter-amount', 'enter-pin'] as Step[]).map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                ['enter-vpa', 'enter-amount', 'enter-pin'].indexOf(step) >= i ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-800'
              }`} />
            ))}
          </div>
        </div>
      )}

      <div className="px-5">
        {/* Step 1: VPA */}
        {step === 'enter-vpa' && (
          <div className="space-y-5 animate-slide-up">
            <div className="bg-white dark:bg-surface-900 rounded-2xl p-5 space-y-4">
              <p className="text-sm font-semibold text-surface-600 dark:text-surface-300">Enter UPI ID or Phone Number</p>
              <Input
                type="text" placeholder="name@upi or 9876543210@paytm"
                value={vpa} onChange={e => { setVpa(e.target.value); setVpaError(''); }}
                error={vpaError} icon={<Search className="w-4 h-4" />}
                autoFocus autoCapitalize="none" autoCorrect="off" id="send-vpa-input"
              />
              <Button fullWidth size="lg" onClick={handleResolveVpa} isLoading={resolving} disabled={!vpa.trim()} id="send-resolve-btn">
                Verify UPI ID
              </Button>
            </div>
            <button onClick={() => router.push('/scan')} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-surface-100 dark:bg-surface-800/50 text-surface-500 dark:text-surface-400 text-sm font-semibold hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors" id="send-open-scanner">
              <QrCode className="w-4 h-4" /> Scan QR Code instead
            </button>
          </div>
        )}

        {/* Step 2: Amount */}
        {step === 'enter-amount' && receiver && (
          <div className="space-y-5 animate-slide-up">
            <div className="bg-white dark:bg-surface-900 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-500/10 flex items-center justify-center">
                <span className="text-lg font-bold text-primary-500">{receiver.displayName[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-surface-800 dark:text-white text-sm">{receiver.displayName}</p>
                <p className="text-xs text-surface-400">{receiver.vpa}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-success-500" />
            </div>

            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2">
                <IndianRupee className="w-8 h-8 text-surface-400" />
                <span className="text-5xl font-bold text-surface-900 dark:text-white font-display tracking-tight">{amount || '0'}</span>
              </div>
              {amountError && <p className="text-xs text-danger-500 mt-2">{amountError}</p>}
              <input type="text" placeholder="Add a note (optional)" value={note} onChange={e => setNote(e.target.value)}
                className="mt-4 text-center text-sm text-surface-500 dark:text-surface-400 bg-transparent border-b border-surface-200 dark:border-surface-700 outline-none pb-1 w-full" maxLength={50}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {numPad.map(k => (
                <button key={k} onClick={() => handleNumPad(k)}
                  className={`py-4 rounded-2xl text-xl font-semibold transition-all duration-150 active:scale-95 ${k === '⌫' ? 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300' : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-white shadow-sm'}`}>
                  {k}
                </button>
              ))}
            </div>

            <Button fullWidth size="lg" onClick={handleAmountNext} disabled={!amount || parseFloat(amount) <= 0} id="send-amount-next">
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 3: PIN */}
        {step === 'enter-pin' && receiver && (
          <div className="space-y-5 animate-slide-up">
            <div className="bg-white dark:bg-surface-900 rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
                <div>
                  <p className="text-xs text-surface-400">Paying to</p>
                  <p className="font-bold text-surface-800 dark:text-white text-sm">{receiver.displayName}</p>
                  <p className="text-xs text-surface-400">{receiver.vpa}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-400">Amount</p>
                  <p className="text-xl font-bold text-surface-900 dark:text-white font-display">₹{parseFloat(amount).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-surface-600 dark:text-surface-300">
                  <Lock className="w-4 h-4" /> Enter UPI PIN
                </div>
                <div className="flex gap-3 justify-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all ${i < pin.length ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-300'}`}>
                      {i < pin.length ? '•' : ''}
                    </div>
                  ))}
                </div>
                {pinError && <p className="text-xs text-danger-500 text-center">{pinError}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, idx) => (
                  <button key={idx} onClick={() => { if (k === '⌫') setPin(p => p.slice(0,-1)); else if (k && pin.length < 6) setPin(p => p + k); setPinError(''); }}
                    disabled={!k}
                    className={`py-4 rounded-2xl text-xl font-semibold transition-all duration-150 active:scale-95 ${!k ? 'invisible' : k === '⌫' ? 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300' : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-white shadow-sm'}`}>
                    {k}
                  </button>
                ))}
              </div>

              <Button fullWidth size="lg" onClick={handleSend} isLoading={loading} disabled={pin.length < 4} id="send-confirm-btn">
                Pay ₹{parseFloat(amount || '0').toLocaleString('en-IN')}
              </Button>
            </div>
          </div>
        )}

        {/* Success */}
        {step === 'success' && receiver && (
          <div className="flex flex-col items-center justify-center pt-12 space-y-6 animate-scale-in">
            <div className="w-28 h-28 rounded-full bg-success-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-16 h-16 text-success-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-surface-900 dark:text-white font-display">Payment Successful!</h2>
              <p className="text-surface-500 mt-1">₹{parseFloat(amount).toLocaleString('en-IN')} sent to {receiver.displayName}</p>
            </div>
            <div className="bg-white dark:bg-surface-900 rounded-2xl p-5 w-full space-y-3">
              {[['Recipient', receiver.displayName], ['UPI ID', receiver.vpa], ['Amount', `₹${parseFloat(amount).toLocaleString('en-IN')}`], note ? ['Note', note] : null].filter(Boolean).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-surface-400">{k}</span>
                  <span className={`font-semibold ${k === 'Amount' ? 'text-success-600' : 'text-surface-800 dark:text-white'}`}>{v}</span>
                </div>
              ))}
            </div>
            <div className="w-full space-y-3">
              <Button fullWidth size="lg" onClick={() => router.push('/dashboard')} id="send-success-home">Back to Home</Button>
              <Button fullWidth variant="secondary" onClick={() => { setStep('enter-vpa'); setVpa(''); setAmount(''); setPin(''); setNote(''); setReceiver(null); }} id="send-another">Send Again</Button>
            </div>
          </div>
        )}

        {/* Failure */}
        {step === 'failure' && (
          <div className="flex flex-col items-center justify-center pt-12 space-y-6 animate-scale-in">
            <div className="w-28 h-28 rounded-full bg-danger-500/10 flex items-center justify-center">
              <AlertCircle className="w-16 h-16 text-danger-500" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-surface-900 dark:text-white font-display">Payment Failed</h2>
              <p className="text-surface-500 mt-1">{errorMessage || 'Something went wrong. Please try again.'}</p>
            </div>
            <div className="w-full space-y-3">
              <Button fullWidth onClick={() => setStep('enter-pin')} id="send-retry-btn">Try Again</Button>
              <Button fullWidth variant="secondary" onClick={() => router.push('/dashboard')} id="send-failure-home">Back to Home</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SendMoneyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SendMoneyContent />
    </Suspense>
  );
}
