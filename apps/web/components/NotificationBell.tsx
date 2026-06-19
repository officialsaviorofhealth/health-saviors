'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Bell, BellOff, Check, Trophy, Heart, MessageSquare, Clock, Sparkles, Trash2 } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  icon: string | null;
  category: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 60_000; // refresh unread count once a minute when tab is focused

const CATEGORY_META: Record<string, { Icon: typeof Trophy; color: string; label: string }> = {
  rewards:        { Icon: Trophy,         color: '#F59E0B', label: 'Reward' },
  reminders:      { Icon: Clock,          color: '#3B82F6', label: 'Reminder' },
  agentFollowups: { Icon: Heart,          color: '#10B981', label: 'Agent' },
  community:      { Icon: MessageSquare,  color: '#A855F7', label: 'Community' },
  system:         { Icon: Sparkles,       color: '#64748B', label: 'System' },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

// Bell button + dropdown panel that lives in the navbar.
// - Polls unread count every 60s while tab is focused
// - Listens for the in-page `healthLog:updated` event so it refreshes after meal/water log
// - Marks all as read when dropdown opens
export function NotificationBell() {
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToken(localStorage.getItem('token'));
    const sync = () => setToken(localStorage.getItem('token'));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const headers = useCallback((t: string) => ({ Authorization: `Bearer ${t}` }), []);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20', { headers: headers(token) });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } finally {
      setLoading(false);
    }
  }, [token, headers]);

  // Initial fetch + poll while tab is visible
  useEffect(() => {
    if (!token) return;
    refresh();
    let id: any;
    const start = () => { if (!id) id = setInterval(refresh, POLL_MS); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    if (document.visibilityState === 'visible') start();
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, [token, refresh]);

  // Refresh on app events (e.g. meal logged, like received)
  useEffect(() => {
    if (!token) return;
    const onUpdate = () => refresh();
    window.addEventListener('healthLog:updated', onUpdate);
    return () => window.removeEventListener('healthLog:updated', onUpdate);
  }, [token, refresh]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleOpen() {
    setOpen(o => !o);
    if (!open) {
      // Opening — refresh first, then mark all read
      await refresh();
      if (unread > 0 && token) {
        await fetch('/api/notifications/read', {
          method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => {});
        setUnread(0);
        // Locally flip read so UI updates without re-fetch
        setItems(prev => prev.map(i => ({ ...i, read: true })));
      }
    }
  }

  async function clearAll() {
    if (!token || !confirm('Clear all notifications?')) return;
    await fetch('/api/notifications', { method: 'DELETE', headers: headers(token) }).catch(() => {});
    setItems([]);
    setUnread(0);
  }

  if (!token) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button onClick={handleOpen}
        className="relative p-2 rounded-full hover:bg-black/[0.04] transition text-text-secondary hover:text-text-primary"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center"
            style={{ boxShadow: '0 0 0 2px var(--bg)' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' }}
            className="fixed sm:absolute right-3 sm:right-0 sm:!top-auto sm:mt-2 w-[calc(100vw-1.5rem)] max-w-[360px] sm:w-[360px] origin-top-right z-50"
          >
            <div className="card rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                <p className="text-sm font-semibold text-text-primary">Notifications</p>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <button onClick={clearAll}
                      className="text-text-muted hover:text-red-500 transition p-1 rounded" title="Clear all">
                      <Trash2 size={13} />
                    </button>
                  )}
                  <Link href="/notifications" onClick={() => setOpen(false)}
                    className="text-[11px] text-accent font-semibold hover:text-accent-hover">
                    Settings
                  </Link>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                {loading && items.length === 0 ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-text-muted text-sm">
                    <span className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    Loading
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-10 text-center">
                    <BellOff size={28} className="mx-auto mb-2 text-text-muted opacity-40" />
                    <p className="text-sm text-text-secondary">No notifications yet</p>
                    <p className="text-xs text-text-muted mt-1">Streak rewards & follow-ups will appear here.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border-subtle">
                    {items.map(n => {
                      const meta = CATEGORY_META[n.category || 'system'] || CATEGORY_META.system;
                      const Icon = meta.Icon;
                      const inner = (
                        <div className="flex items-start gap-3 px-4 py-3 hover:bg-black/[0.02] transition">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
                            <Icon size={14} style={{ color: meta.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-text-primary leading-snug truncate">
                                {n.title}
                              </p>
                              <span className="text-[11px] text-text-muted shrink-0 mt-0.5">{timeAgo(n.createdAt)}</span>
                            </div>
                            {n.body && (
                              <p className="text-xs text-text-secondary mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                            )}
                          </div>
                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
                          )}
                        </div>
                      );
                      return (
                        <li key={n.id}>
                          {n.url
                            ? <Link href={n.url} onClick={() => setOpen(false)}>{inner}</Link>
                            : inner}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="px-4 py-2.5 border-t border-border-subtle flex items-center justify-center">
                  <Link href="/notifications" onClick={() => setOpen(false)}
                    className="text-xs text-text-muted hover:text-accent transition flex items-center gap-1">
                    <Check size={11} /> Manage notifications
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
