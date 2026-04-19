// ═══════════════════════════════════════════════════════
//  Login Page
// ═══════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { isValidEmail } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { addToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!isValidEmail(email)) newErrors.email = 'Enter a valid email';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 6) newErrors.password = 'Min 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await login(email, password);
      addToast('Welcome back!', 'success');
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      addToast(message, 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-surface-50 dark:bg-surface-950">
      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold font-display text-surface-900 dark:text-white">
            PayFlow
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm">
            Welcome back! Sign in to your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
            error={errors.email}
            icon={<Mail className="w-4 h-4" />}
            autoComplete="email"
            id="login-email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
            error={errors.password}
            icon={<Lock className="w-4 h-4" />}
            autoComplete="current-password"
            id="login-password"
          />

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              id="login-submit"
            >
              Continue
            </Button>
          </div>
        </form>

        {/* Register Link */}
        <p className="text-center text-sm text-surface-500 dark:text-surface-400">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-primary-500 font-semibold hover:text-primary-400 transition-colors"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
