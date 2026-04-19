// ═══════════════════════════════════════════════════════
//  Utility Functions
// ═══════════════════════════════════════════════════════

/**
 * Format a number as Indian Rupee currency
 */
export function formatRupee(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format amount without currency symbol (for large balance display)
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date relative to now (Today, Yesterday, or date)
 */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format timestamp to time string
 */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate a unique idempotency key for transactions
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Mask a VPA for display (show first and last parts)
 */
export function maskVpa(vpa: string): string {
  const [username, handle] = vpa.split('@');
  if (!username || username.length < 4) return vpa;
  return `${username.slice(0, 2)}***@${handle}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Validate VPA format (username@handle)
 */
export function isValidVpa(vpa: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(vpa);
}

/**
 * cn — Conditional classname merger
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
