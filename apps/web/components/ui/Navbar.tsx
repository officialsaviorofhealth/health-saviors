'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, LogOut, Wallet, Coins, Flame, Settings, User as UserIcon } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

const navLinks = [
  { href: '/wellness', label: 'Wellness' },
  { href: '/symptoms', label: 'Symptoms' },
  { href: '/nutrition', label: 'Nutrition' },
  { href: '/mindspace', label: 'Mind' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/community', label: 'Community' },
];

interface StoredUser {
  displayName?: string;
  tokenBalance?: number;
}

interface QuickStats {
  streak: number;
  tokenBalance: number;
}

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch {}
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch global stats (streak + H2E) once on mount + whenever a log fires
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    const refresh = async () => {
      try {
        // Streak comes back from the water summary endpoint cheaply; balance needs auth/me
        const [w, me] = await Promise.all([
          fetch('/api/logs/water', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        const balance =
          (me?.user?.tokenBalance) ??
          (typeof window !== 'undefined' && (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').tokenBalance; } catch { return 0; } })()) ??
          0;
        setStats({
          streak: w?.streak ?? 0,
          tokenBalance: balance,
        });
      } catch {}
    };

    refresh();
    const onUpdate = () => refresh();
    window.addEventListener('healthLog:updated', onUpdate);
    return () => window.removeEventListener('healthLog:updated', onUpdate);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500
      ${scrolled || mobileOpen ? 'bg-bg/85 backdrop-blur-xl border-b border-border-subtle' : 'bg-transparent'}`}
      style={{
        boxShadow: scrolled ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 sm:h-20 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <img
              src="/icons/icon-192.png"
              alt="Health Saviors"
              width={32}
              height={32}
              className="w-8 h-8 object-contain transition-transform group-hover:scale-105"
            />
            <span className="text-text-primary font-medium text-sm tracking-tight hidden sm:inline">
              Health Saviors
            </span>
          </Link>

          {/* Desktop Nav — floating glass pill */}
          <div className="hidden md:flex items-center gap-0.5 glass rounded-full px-1.5 py-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200
                    ${isActive
                      ? 'text-text-primary bg-black/[0.05]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-black/[0.03]'
                    }`}>
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Persistent stats chip — visible on every page when logged in */}
            {user && stats && (
              <Link href="/dashboard"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle hover:bg-black/[0.05] transition"
                title="Streak · H2E balance">
                {stats.streak > 0 && (
                  <span className="flex items-center gap-1 text-xs">
                    <Flame size={11} className="text-orange-500" />
                    <span className="font-mono tabular-nums text-text-primary">{stats.streak}d</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs">
                  <Coins size={11} className="text-accent" />
                  <span className="font-mono tabular-nums text-text-primary">{stats.tokenBalance.toLocaleString()}</span>
                </span>
              </Link>
            )}

            {/* Bell */}
            {user && <NotificationBell />}

            {user ? (
              <div className="relative">
                <button onClick={() => setAccountOpen(o => !o)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full glass-subtle hover:bg-black/[0.05] transition-colors">
                  <span className="w-6 h-6 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-[10px] text-accent font-semibold">
                    {(user.displayName || '?').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-xs text-text-primary max-w-[120px] truncate hidden sm:inline">
                    {user.displayName || 'Account'}
                  </span>
                </button>

                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 z-50 card rounded-2xl overflow-hidden shadow-2xl py-1.5">
                      {/* Mobile-only stats inside the menu, since the chip is hidden on small screens */}
                      {stats && (
                        <Link href="/dashboard" onClick={() => setAccountOpen(false)}
                          className="sm:hidden flex items-center justify-between px-4 py-2 text-xs text-text-secondary hover:bg-black/[0.04]">
                          <span className="flex items-center gap-1.5"><Flame size={11} className="text-orange-500" /> {stats.streak}d streak</span>
                          <span className="flex items-center gap-1.5"><Coins size={11} className="text-accent" /> {stats.tokenBalance.toLocaleString()}</span>
                        </Link>
                      )}
                      <Link href="/mypage" onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-black/[0.04]">
                        <UserIcon size={14} className="text-text-muted" /> Profile
                      </Link>
                      <Link href="/notifications" onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-primary hover:bg-black/[0.04]">
                        <Settings size={14} className="text-text-muted" /> Notifications &amp; Install
                      </Link>
                      <div className="my-1 border-t border-border-subtle" />
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:bg-black/[0.04] hover:text-red-500">
                        <LogOut size={14} /> Disconnect
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" className="hidden sm:inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
                <Wallet size={14} /> Connect
              </Link>
            )}

            {/* Mobile toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-1 space-y-1 border-t border-border-subtle">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}
                  className={`block px-4 py-3 text-base font-medium rounded-xl transition-colors
                    ${isActive ? 'text-text-primary bg-black/[0.05]' : 'text-text-secondary active:bg-black/[0.03]'}`}>
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2 mt-2 border-t border-border-subtle">
              {user ? (
                <>
                  <Link href="/mypage" className="block px-4 py-3 text-base text-text-primary rounded-xl active:bg-black/[0.03]">Profile</Link>
                  <Link href="/notifications" className="block px-4 py-3 text-base text-text-primary rounded-xl active:bg-black/[0.03]">Notifications &amp; Install</Link>
                  <button onClick={handleLogout} className="w-full px-4 py-3 text-base text-left text-red-500 rounded-xl active:bg-black/[0.03]">
                    Disconnect
                  </button>
                </>
              ) : (
                <Link href="/login" className="block px-4 py-3 text-base text-accent font-medium">
                  Connect Wallet
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
