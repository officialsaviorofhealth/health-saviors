'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wallet, CheckCircle, Shield, Fingerprint, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };

// Only allow same-origin redirects to prevent open-redirect abuse
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function WalletConnectPage() {
  const router = useRouter();
  // Read ?next= once on mount — using window.location avoids Suspense
  // requirements that come with useSearchParams in Next 14.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('next');
    setNext(safeNext(raw));
  }, []);

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const authAttempted = useRef(false);

  useEffect(() => {
    if (isConnected && address && !success && !authenticating && !authAttempted.current) {
      authAttempted.current = true;
      handleAuth(address);
    }
  }, [isConnected, address]);

  const handleAuth = async (walletAddress: string) => {
    setError('');
    setAuthenticating(true);

    try {
      const nonceRes = await fetch(`/api/auth/wallet?address=${walletAddress}`);
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();

      const signature = await signMessageAsync({ message: nonce });

      const authRes = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, signature }),
      });

      if (!authRes.ok) throw new Error('Authentication failed');
      const { token, user } = await authRes.json();

      setSuccess(true);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      setTimeout(() => {
        // First-time users (no displayName) → set nickname.
        // Returning users → wherever they were trying to go (?next=) or home.
        if (!user.displayName) {
          router.push('/signup');
        } else {
          router.push(next || '/');
        }
      }, 800);
    } catch (err: any) {
      authAttempted.current = false;
      if (err?.message?.includes('User rejected') || err?.code === 4001) {
        setError('Signature rejected. Please try again.');
      } else {
        setError(err?.message || 'Authentication failed. Please try again.');
      }
      setAuthenticating(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative overflow-hidden">
      <div className="absolute top-0 -right-40 w-[520px] h-[520px] rounded-full bg-accent/[0.05] blur-[140px] pointer-events-none float-slow" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[100dvh] grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center py-24">
        {/* Left — narrative */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="hidden lg:block space-y-8">
          <motion.div variants={fadeIn} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass">
            <Fingerprint size={11} className="text-accent" />
            <span className="text-[10px] font-mono tracking-[0.22em] uppercase text-text-secondary">Sign in · Read-only</span>
          </motion.div>
          <motion.h1 variants={fadeIn} className="font-display text-6xl xl:text-7xl text-text-primary">
            Your wallet,<br /><span className="text-gradient-health">your identity.</span>
          </motion.h1>
          <motion.p variants={fadeIn} className="text-base text-text-secondary max-w-[48ch] leading-relaxed">
            No email. No password. Sign a message and your streak becomes yours on-chain.
          </motion.p>
          <motion.div variants={fadeIn} className="space-y-3 pt-4">
            {[
              { icon: Wallet, label: 'Connect your wallet' },
              { icon: Fingerprint, label: 'Sign a verification message' },
              { icon: Zap, label: 'Your AI agents are ready' },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-[10px] font-mono text-text-muted w-6">0{i + 1}</span>
                <div className="w-8 h-8 rounded-full glass-subtle flex items-center justify-center">
                  <item.icon size={13} className="text-text-secondary" />
                </div>
                <span className="text-sm text-text-secondary">{item.label}</span>
              </div>
            ))}
          </motion.div>
          <motion.div variants={fadeIn} className="flex items-center gap-2 text-[10px] text-text-muted pt-2">
            <Shield size={11} />
            <span className="tracking-[0.12em] uppercase">No transactions · No gas · Read-only signature</span>
          </motion.div>
        </motion.div>

        {/* Right — the card */}
        <motion.div variants={stagger} initial="hidden" animate="visible" className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto space-y-6">
        <motion.div variants={fadeIn} className="glass rounded-3xl p-8 sm:p-10 space-y-8">
        <div className="space-y-5">
          <div className="w-16 h-16 rounded-2xl glass-subtle flex items-center justify-center">
            <Wallet size={24} className="text-accent" />
          </div>
          <div>
            <h1 className="font-display text-4xl text-text-primary">Connect Wallet</h1>
            <p className="text-base text-text-secondary mt-3">Sign in with your wallet — set a nickname next.</p>
          </div>
        </div>

        {error && (
          <motion.div variants={fadeIn} className="p-4 rounded-2xl bg-status-red/5 border border-status-red/10 text-status-red text-sm text-center">
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div variants={fadeIn} className="p-4 rounded-2xl bg-status-green/5 border border-status-green/10 text-status-green text-sm text-center flex items-center justify-center gap-2">
            <CheckCircle size={16} />
            Wallet connected! Redirecting...
          </motion.div>
        )}

        <motion.div variants={fadeIn} className="flex justify-center">
          {authenticating || success ? (
            <button disabled className="w-full flex items-center justify-center gap-3 text-[11px] font-medium tracking-[0.1em] uppercase bg-titanium-light text-matte py-4 rounded-full opacity-30 cursor-not-allowed">
              {success ? (<><CheckCircle size={16} /> Connected</>) : (<><div className="w-4 h-4 border-2 border-matte/30 border-t-matte rounded-full animate-spin" /> Authenticating...</>)}
            </button>
          ) : (
            <div className="w-full [&_button]:w-full [&_button]:py-4 [&_button]:rounded-full">
              <ConnectButton />
            </div>
          )}
        </motion.div>

        </motion.div>
        <motion.div variants={fadeIn} className="lg:hidden flex items-center justify-center gap-2 text-[10px] text-text-muted">
          <Shield size={11} />
          <span className="tracking-wider">No transactions · No gas · Read-only</span>
        </motion.div>
      </motion.div>
      </div>
    </div>
  );
}
