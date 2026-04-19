// ═══════════════════════════════════════════════════════
//  Profile Page — User Info, VPA Management, Accounts
// ═══════════════════════════════════════════════════════

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut, User, CreditCard, Zap, Shield, Sun, Moon,
  Plus, Check, Trash2, Star, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAccountStore } from '@/stores/useAccountStore';
import { upiService } from '@/services/upi.service';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/components/ThemeProvider';
import type { UpiId, BankAccount } from '@/types/transaction.types';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { accounts, activeAccount, balance } = useAccountStore();
  const { addToast } = useToast();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [vpas, setVpas] = useState<UpiId[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loadingVpas, setLoadingVpas] = useState(true);
  const [loadingBanks, setLoadingBanks] = useState(true);

  // Modal states
  const [showCreateVpa, setShowCreateVpa] = useState(false);
  const [showLinkBank, setShowLinkBank] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

  // Form states
  const [vpaUsername, setVpaUsername] = useState('');
  const [bankForm, setBankForm] = useState({ bankCode: '', accountNumber: '', accountHolderName: '' });
  const [newPin, setNewPin] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadVpas = useCallback(async () => {
    try {
      const data = await upiService.listUpiIds();
      setVpas(data);
    } catch {
      setVpas([]);
    } finally {
      setLoadingVpas(false);
    }
  }, []);

  const loadBanks = useCallback(async () => {
    try {
      const data = await upiService.listBankAccounts();
      setBankAccounts(data);
    } catch {
      setBankAccounts([]);
    } finally {
      setLoadingBanks(false);
    }
  }, []);

  useEffect(() => {
    loadVpas();
    loadBanks();
  }, [loadVpas, loadBanks]);

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const handleCreateVpa = async () => {
    if (!vpaUsername.trim()) { addToast('Enter a username', 'error'); return; }
    if (!activeAccount) { addToast('No active account', 'error'); return; }
    setFormLoading(true);
    try {
      await upiService.createUpiId({
        username: vpaUsername.trim(),
        accountId: activeAccount._id,
      });
      addToast('UPI ID created!', 'success');
      setShowCreateVpa(false);
      setVpaUsername('');
      loadVpas();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create UPI ID', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSetDefault = async (vpa: string) => {
    try {
      await upiService.setDefaultUpiId(vpa);
      addToast('Default UPI ID updated', 'success');
      loadVpas();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  };

  const handleDeactivateVpa = async (vpa: string) => {
    try {
      await upiService.deactivateUpiId(vpa);
      addToast('UPI ID deactivated', 'success');
      loadVpas();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  };

  const handleLinkBank = async () => {
    const { bankCode, accountNumber, accountHolderName } = bankForm;
    if (!bankCode || !accountNumber || !accountHolderName) {
      addToast('Fill all fields', 'error'); return;
    }
    setFormLoading(true);
    try {
      await upiService.linkBankAccount(bankForm);
      addToast('Bank account linked!', 'success');
      setShowLinkBank(false);
      setBankForm({ bankCode: '', accountNumber: '', accountHolderName: '' });
      loadBanks();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length < 4) { addToast('PIN must be at least 4 digits', 'error'); return; }
    setFormLoading(true);
    try {
      await upiService.setUpiPin(selectedBankId, { newPin });
      addToast('UPI PIN set successfully!', 'success');
      setShowSetPin(false);
      setNewPin('');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 pb-4">
      {/* Header */}
      <div className="px-5 pt-14 pb-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg font-bold text-surface-900 dark:text-white font-display">Profile</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* ── User Card ── */}
        <div className="balance-card">
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-white font-display">{initials}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">{user?.name}</h2>
              <p className="text-white/70 text-sm">{user?.email}</p>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15">
                <Shield className="w-3 h-3 text-white/80" />
                <span className="text-white/80 text-[10px] font-semibold">Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick Stats ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-4">
            <p className="text-xs text-surface-400 dark:text-surface-500">Balance</p>
            <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-1">
              ₹{balance.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white dark:bg-surface-900 rounded-2xl p-4">
            <p className="text-xs text-surface-400 dark:text-surface-500">Accounts</p>
            <p className="text-xl font-bold text-surface-900 dark:text-white font-display mt-1">
              {accounts.length}
            </p>
          </div>
        </div>

        {/* ── UPI IDs ── */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-50 dark:border-surface-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-bold text-surface-800 dark:text-white">UPI IDs</span>
            </div>
            <button
              onClick={() => setShowCreateVpa(true)}
              className="text-xs font-semibold text-primary-500 flex items-center gap-1"
              id="profile-add-vpa-btn"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          {loadingVpas ? (
            <div className="p-4 space-y-3">
              {[1,2].map(i => <div key={i} className="h-10 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse" />)}
            </div>
          ) : vpas.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-surface-400">No UPI IDs yet</p>
              <button onClick={() => setShowCreateVpa(true)} className="text-xs text-primary-500 mt-1 font-semibold">
                Create one
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-50 dark:divide-surface-800/50">
              {vpas.map(vpa => (
                <div key={vpa._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-800 dark:text-white truncate">{vpa.vpa}</p>
                    {vpa.isDefault && (
                      <span className="text-[10px] font-bold text-success-600 uppercase tracking-wider">Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!vpa.isDefault && (
                      <button onClick={() => handleSetDefault(vpa.vpa)} className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400" title="Set as default">
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {vpa.isDefault && <Check className="w-4 h-4 text-success-500" />}
                    <button onClick={() => handleDeactivateVpa(vpa.vpa)} className="p-1.5 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-500/10 text-surface-400 hover:text-danger-500" title="Deactivate">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Bank Accounts ── */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-50 dark:border-surface-800">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-bold text-surface-800 dark:text-white">Bank Accounts</span>
            </div>
            <button
              onClick={() => setShowLinkBank(true)}
              className="text-xs font-semibold text-primary-500 flex items-center gap-1"
              id="profile-add-bank-btn"
            >
              <Plus className="w-3 h-3" /> Link
            </button>
          </div>

          {loadingBanks ? (
            <div className="p-4 space-y-3">
              {[1].map(i => <div key={i} className="h-12 rounded-xl bg-surface-100 dark:bg-surface-800 animate-pulse" />)}
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-surface-400">No bank accounts linked</p>
              <button onClick={() => setShowLinkBank(true)} className="text-xs text-primary-500 mt-1 font-semibold">
                Link now
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-50 dark:divide-surface-800/50">
              {bankAccounts.map(bank => (
                <div key={bank._id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-xl bg-success-500/10 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-success-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-800 dark:text-white">{bank.bankCode}</p>
                    <p className="text-xs text-surface-400">••••{bank.accountNumber.slice(-4)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!bank.isVerified && (
                      <span className="text-[10px] font-bold text-warning-600 uppercase">Unverified</span>
                    )}
                    {bank.isPrimary && <Check className="w-4 h-4 text-success-500" />}
                    <button
                      onClick={() => { setSelectedBankId(bank._id); setShowSetPin(true); }}
                      className="text-xs text-primary-500 font-semibold"
                    >
                      Set PIN
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Settings ── */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-surface-50 dark:border-surface-800">
            <p className="text-sm font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Settings</p>
          </div>
          <div className="divide-y divide-surface-50 dark:divide-surface-800/50">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              id="profile-theme-toggle"
            >
              {resolvedTheme === 'dark'
                ? <Sun className="w-4 h-4 text-warning-500" />
                : <Moon className="w-4 h-4 text-surface-500" />}
              <span className="flex-1 text-sm font-semibold text-surface-800 dark:text-surface-200 text-left">
                {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </span>
              <ChevronRight className="w-4 h-4 text-surface-400" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3.5 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
              id="profile-logout-btn"
            >
              <LogOut className="w-4 h-4 text-danger-500" />
              <span className="flex-1 text-sm font-semibold text-danger-500 text-left">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Create VPA Modal ── */}
      <Modal isOpen={showCreateVpa} onClose={() => setShowCreateVpa(false)} title="Create UPI ID">
        <div className="space-y-4">
          <Input
            label="UPI Username"
            type="text"
            placeholder="e.g. john.doe"
            value={vpaUsername}
            onChange={e => setVpaUsername(e.target.value)}
            autoCapitalize="none"
            id="create-vpa-username"
          />
          <p className="text-xs text-surface-400">Your UPI ID will be: {vpaUsername || 'username'}@payflow</p>
          <Button fullWidth onClick={handleCreateVpa} isLoading={formLoading} id="create-vpa-submit">
            Create UPI ID
          </Button>
        </div>
      </Modal>

      {/* ── Link Bank Modal ── */}
      <Modal isOpen={showLinkBank} onClose={() => setShowLinkBank(false)} title="Link Bank Account">
        <div className="space-y-4">
          <Input
            label="Bank Code (IFSC)"
            type="text"
            placeholder="e.g. HDFC0001234"
            value={bankForm.bankCode}
            onChange={e => setBankForm(p => ({ ...p, bankCode: e.target.value }))}
            autoCapitalize="characters"
            id="link-bank-code"
          />
          <Input
            label="Account Number"
            type="text"
            placeholder="Enter account number"
            value={bankForm.accountNumber}
            onChange={e => setBankForm(p => ({ ...p, accountNumber: e.target.value }))}
            inputMode="numeric"
            id="link-bank-number"
          />
          <Input
            label="Account Holder Name"
            type="text"
            placeholder="As per bank records"
            value={bankForm.accountHolderName}
            onChange={e => setBankForm(p => ({ ...p, accountHolderName: e.target.value }))}
            id="link-bank-name"
          />
          <Button fullWidth onClick={handleLinkBank} isLoading={formLoading} id="link-bank-submit">
            Link Account
          </Button>
        </div>
      </Modal>

      {/* ── Set PIN Modal ── */}
      <Modal isOpen={showSetPin} onClose={() => setShowSetPin(false)} title="Set UPI PIN">
        <div className="space-y-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Set a 4–6 digit PIN for authenticating payments.
          </p>
          <Input
            label="New UPI PIN"
            type="password"
            placeholder="4–6 digits"
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            id="set-pin-input"
          />
          <Button fullWidth onClick={handleSetPin} isLoading={formLoading} id="set-pin-submit">
            Set PIN
          </Button>
        </div>
      </Modal>
    </div>
  );
}
