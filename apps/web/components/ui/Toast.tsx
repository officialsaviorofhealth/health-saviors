'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

export interface ToastMessage {
  id: number;
  title: string;
  subtitle?: string;
  points?: number;
  accent?: string;
}

export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const push = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = Date.now() + Math.random();
    setMessages(prev => [...prev, { ...msg, id }]);
    setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 3800);
  }, []);
  return { messages, push };
}

export function ToastStack({ messages }: { messages: ToastMessage[] }) {
  return (
    <div className="fixed top-20 right-4 sm:right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {messages.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass rounded-2xl px-5 py-4 min-w-[280px] max-w-sm pointer-events-auto shadow-2xl"
            style={{ borderLeft: `2px solid ${m.accent || '#22c55e'}` }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `${m.accent || '#22c55e'}20`, border: `1px solid ${m.accent || '#22c55e'}40` }}
              >
                <Check size={14} style={{ color: m.accent || '#22c55e' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{m.title}</p>
                {m.subtitle && <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{m.subtitle}</p>}
                {m.points ? (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Sparkles size={11} className="text-accent" />
                    <span className="text-xs font-mono text-accent">+{m.points} H2E</span>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
