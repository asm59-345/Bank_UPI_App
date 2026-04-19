'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Zap, Camera, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { isValidVpa } from '@/lib/utils';

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState('');
  const [cameraPermission, setCameraPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleQrResult = useCallback((rawValue: string) => {
    stopCamera();
    setScanning(false);

    // Try UPI deep link: upi://pay?pa=vpa&pn=name&am=amount
    try {
      const url = new URL(rawValue);
      if (url.protocol === 'upi:') {
        const vpa = url.searchParams.get('pa') || '';
        const name = url.searchParams.get('pn') || '';
        const amount = url.searchParams.get('am') || '';
        setScanned(vpa);
        setTimeout(() => {
          router.push(
            `/send?vpa=${encodeURIComponent(vpa)}&name=${encodeURIComponent(name)}&amount=${encodeURIComponent(amount)}`
          );
        }, 800);
        return;
      }
    } catch {
      // Not a URL — check plain VPA
    }

    if (isValidVpa(rawValue)) {
      setScanned(rawValue);
      setTimeout(() => {
        router.push(`/send?vpa=${encodeURIComponent(rawValue)}`);
      }, 800);
    } else {
      setError(`Unrecognised QR code. Try entering UPI ID manually.`);
      setScanning(false);
    }
  }, [router, stopCamera]);

  const startQrScan = useCallback(() => {
    if (!('BarcodeDetector' in window)) {
      setError('QR scanning needs Chrome 88+ or Edge 88+. Enter UPI ID manually below.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });

    intervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const codes: any[] = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          handleQrResult(codes[0].rawValue);
        }
      } catch {
        // silent per-frame fail
      }
    }, 300);
  }, [handleQrResult]);

  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraPermission('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        startQrScan();
      }
    } catch {
      setCameraPermission('denied');
      setError('Camera access denied. Please allow camera access and try again.');
    }
  }, [startQrScan]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="min-h-screen bg-[#0b1326] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4 relative z-10">
        <button
          onClick={() => { stopCamera(); router.back(); }}
          className="p-2.5 rounded-xl bg-white/10 text-white"
          id="scan-back-btn"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white font-display">Scan QR Code</h1>
          <p className="text-xs text-white/60">Point at any UPI QR code</p>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Dark vignette overlay */}
        <div className="absolute inset-0 bg-black/40" />

        {/* Scan Frame */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative w-64 h-64">
            {/* Corner brackets */}
            {([
              ['top-0 left-0', 'border-t-4 border-l-4'],
              ['top-0 right-0', 'border-t-4 border-r-4'],
              ['bottom-0 left-0', 'border-b-4 border-l-4'],
              ['bottom-0 right-0', 'border-b-4 border-r-4'],
            ] as [string, string][]).map(([pos, border]) => (
              <div
                key={pos}
                className={`absolute w-8 h-8 ${pos} ${border} border-white rounded-sm`}
              />
            ))}

            {/* Scan line — pure CSS animation via inline style */}
            {scanning && !scanned && (
              <div
                className="absolute left-2 right-2 h-0.5 bg-indigo-400/90 rounded-full shadow-lg"
                style={{ animation: 'scanLine 2s ease-in-out infinite' }}
              />
            )}

            {/* Success overlay */}
            {scanned && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 rounded-xl backdrop-blur-sm">
                <Zap className="w-16 h-16 text-emerald-400" />
              </div>
            )}
          </div>

          {scanning && !scanned && (
            <p className="text-white/70 text-sm text-center px-8">
              Align the QR code within the frame
            </p>
          )}

          {scanned && (
            <div className="bg-emerald-500/20 backdrop-blur-xl rounded-2xl px-5 py-3 flex items-center gap-3">
              <Zap className="w-5 h-5 text-emerald-400" />
              <p className="text-emerald-400 text-sm font-semibold">QR Detected! Redirecting…</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="px-5 pb-10 relative z-10 space-y-3">
        {error && (
          <div className="bg-red-500/20 backdrop-blur-xl rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {cameraPermission === 'denied' && (
          <Button fullWidth variant="secondary" onClick={startCamera} id="scan-retry-camera">
            <Camera className="w-4 h-4" />
            Retry Camera
          </Button>
        )}

        <button
          onClick={() => { stopCamera(); router.push('/send'); }}
          className="w-full py-3 text-white/70 hover:text-white text-sm font-semibold transition-colors"
          id="scan-enter-manually"
        >
          Enter UPI ID manually
        </button>
      </div>

      {/* Scan line CSS keyframe — inlined in <head> safely via global style */}
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 8px; opacity: 1; }
          50% { top: calc(100% - 8px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
