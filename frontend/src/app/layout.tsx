// ═══════════════════════════════════════════════════════
//  Root Layout — Fonts, Theme Provider, Toast
// ═══════════════════════════════════════════════════════

import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { ToastContainer } from '@/components/ui/Toast';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PayFlow — UPI Banking System',
  description: 'Send money, request payments, and manage your finances with PayFlow — your modern UPI banking companion.',
  keywords: ['UPI', 'banking', 'payments', 'fintech', 'digital wallet'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ToastContainer />
          <main className="min-h-screen">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
