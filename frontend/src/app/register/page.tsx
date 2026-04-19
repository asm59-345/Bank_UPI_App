// ═══════════════════════════════════════════════════════
//  Register Page
// ═══════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { isValidEmail } from '@/lib/utils';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email) e.email = 'Email is required';
    else if (!isValidEmail(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Min 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await register(name.trim(), email, password);
      addToast('Account created successfully!', 'success');
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      addToast(message, 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 bg-surface-50 dark:bg-surface-950">
      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-success-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold font-display text-surface-900 dark:text-white">
            Create Account
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm">
            Join PayFlow and start transacting
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" id="register-form">
          <Input
            label="Full Name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
            error={errors.name}
            icon={<User className="w-4 h-4" />}
            autoComplete="name"
            id="register-name"
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })); }}
            error={errors.email}
            icon={<Mail className="w-4 h-4" />}
            autoComplete="email"
            id="register-email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })); }}
            error={errors.password}
            icon={<Lock className="w-4 h-4" />}
            autoComplete="new-password"
            id="register-password"
          />

          <Input
            label="Confirm Password"
            type="password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })); }}
            error={errors.confirmPassword}
            icon={<Lock className="w-4 h-4" />}
            autoComplete="new-password"
            id="register-confirm-password"
          />

          <div className="pt-2">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              id="register-submit"
            >
              Create Account
            </Button>
          </div>
        </form>

        {/* Login Link */}
        <p className="text-center text-sm text-surface-500 dark:text-surface-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-primary-500 font-semibold hover:text-primary-400 transition-colors"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
