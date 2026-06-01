// ═══════════════════════════════════════════════════════
//  QR Code Modal Component
// ═══════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { useToast } from '@/hooks/useToast';
import { QrCode, Copy, Download, Check } from 'lucide-react';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  vpa: string;
  name: string;
}

export function QrCodeModal({ isOpen, onClose, vpa, name }: QrCodeModalProps) {
  const { addToast } = useToast();
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [copied, setCopied] = useState(false);

  // Construct UPI deep-link
  // Format: upi://pay?pa=vpa@bank&pn=MerchantName&am=10.00&tn=Remarks&cu=INR
  let upiUri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&cu=INR`;
  if (amount && !isNaN(Number(amount))) {
    upiUri += `&am=${Number(amount).toFixed(2)}`;
  }
  if (remarks.trim()) {
    upiUri += `&tn=${encodeURIComponent(remarks.trim())}`;
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;

  const handleCopyVpa = async () => {
    try {
      await navigator.clipboard.writeText(vpa);
      setCopied(true);
      addToast('UPI ID copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy', 'error');
    }
  };

  const handleDownloadQr = async () => {
    try {
      addToast('Downloading QR Code...', 'success');
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payflow-qr-${vpa.split('@')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      addToast('Download failed. Try saving the image directly.', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My QR Code">
      <div className="flex flex-col items-center space-y-5 text-center p-1">
        {/* Glassmorphic QR Container */}
        <div className="bg-surface-100 dark:bg-surface-900/50 p-6 rounded-3xl border border-surface-200/50 dark:border-surface-800/40 relative overflow-hidden group shadow-lg">
          {/* Subtle orb background glow */}
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-primary-500/10 rounded-full blur-xl transition-all group-hover:scale-110" />
          <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-success-500/10 rounded-full blur-xl transition-all group-hover:scale-110" />

          {/* QR Code Frame */}
          <div className="bg-white p-3 rounded-2xl shadow-inner relative z-10 border border-surface-100 dark:border-surface-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={qrImageUrl} 
              alt="UPI QR Code" 
              className="w-56 h-56 transition-all duration-300 group-hover:scale-[1.02]" 
            />
          </div>

          <div className="mt-4 relative z-10">
            <h4 className="font-bold text-sm text-surface-800 dark:text-white font-display">{name}</h4>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 select-all">{vpa}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <Button 
            variant="secondary" 
            fullWidth 
            onClick={handleCopyVpa}
            id="qr-copy-vpa"
          >
            {copied ? <Check className="w-4 h-4 mr-2 text-success-500" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied' : 'Copy VPA'}
          </Button>
          <Button 
            variant="secondary" 
            fullWidth 
            onClick={handleDownloadQr}
            id="qr-download"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>

        {/* Customization Section */}
        <div className="w-full text-left border-t border-surface-100 dark:border-surface-800 pt-4 space-y-3.5">
          <div className="flex items-center gap-2 mb-1">
            <QrCode className="w-4 h-4 text-primary-500" />
            <h5 className="text-xs font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
              Customize QR Code
            </h5>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Request Amount (₹)"
              type="text"
              placeholder="e.g. 500"
              value={amount}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setAmount(val);
                }
              }}
              inputMode="decimal"
              id="qr-amount-input"
            />
            <Input
              label="Remarks / Note"
              type="text"
              placeholder="e.g. Dinner split"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              maxLength={25}
              id="qr-remarks-input"
            />
          </div>
          
          {amount && (
            <p className="text-[11px] text-center text-primary-500 dark:text-primary-400 font-semibold bg-primary-500/10 py-1.5 px-3 rounded-xl animate-fade-in">
              QR will request exactly ₹{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
