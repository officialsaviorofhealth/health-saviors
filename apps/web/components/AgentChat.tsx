'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Send, Heart, ShieldCheck, Apple, Brain, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { getPersona } from '@/lib/agents';

const iconMap: Record<string, typeof Heart> = { nurse: Heart, gatekeeper: ShieldCheck, nutritionist: Apple, mindcare: Brain };
const colorMap: Record<string, string> = { nurse: '#22c55e', gatekeeper: '#3b82f6', nutritionist: '#f59e0b', mindcare: '#a855f7' };

// NPC-style facial expressions that react to the conversation state.
const FACE: Record<'idle' | 'thinking' | 'happy', string> = { idle: '🙂', thinking: '💭', happy: '😊' };
const STATUS: Record<'idle' | 'thinking' | 'happy', string> = { idle: 'online', thinking: 'typing…', happy: 'here for you' };

interface Props {
  agentType: string;
  compact?: boolean;
  initialMessage?: string;
}

export default function AgentChat({ agentType, compact, initialMessage }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (initialMessage) setInput(initialMessage);
  }, [initialMessage]);
  // Check auth state on mount + when storage changes (e.g. login in another tab)
  useEffect(() => {
    const sync = () => setHasToken(!!localStorage.getItem('token'));
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const Icon = iconMap[agentType] || Heart;
  const color = colorMap[agentType] || '#22c55e';
  const persona = getPersona(agentType);

  // Facial expression reacts to state: thinking while loading, happy right after a reply, else idle.
  const lastRole = messages[messages.length - 1]?.role;
  const face: 'idle' | 'thinking' | 'happy' = loading ? 'thinking' : (lastRole === 'assistant' ? 'happy' : 'idle');

  // Scroll ONLY the chat container — never the page. This avoids the whole page
  // jumping/refocusing on desktop and stops mobile from scrolling to the bottom on mount.
  useEffect(() => {
    if (messages.length === 0) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Bounce to login, preserving where the user was
  function goToLogin() {
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : '';
    router.push(`/login${next}`);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const token = localStorage.getItem('token');
    if (!token) {
      goToLogin();
      return;
    }

    const userMsg = { id: Date.now().toString(), role: 'user', content };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: userMsg.content, agentType, history: messages.slice(-10) }),
      });
      if (res.status === 401) {
        // Stale token — clear and prompt re-login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Your session expired. Please [log in again](/login) to continue.',
        }]);
        return;
      }
      const data = await res.json();

      // If the chat auto-logged meals (AI Nutritionist), notify any listening page
      if (Array.isArray(data.savedMeals) && data.savedMeals.length > 0) {
        try {
          window.dispatchEvent(new CustomEvent('healthLog:updated', {
            detail: { type: 'meal', items: data.savedMeals },
          }));
        } catch {}
      }

      let content = data.response || data.error || 'Connection error. Please try again.';
      // Append a tiny inline confirmation so the user knows it was logged
      if (Array.isArray(data.savedMeals) && data.savedMeals.length > 0) {
        const lines = data.savedMeals.map((m: any) =>
          `• ${m.mealType}: ${m.description}${m.calories ? ` — ${m.calories} kcal` : ''}`
        ).join('\n');
        content += `\n\n— logged to your meal diary —\n${lines}`;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Connection error. Please try again.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Persona + live facial expression (changes with conversation state) */}
      <div className="flex items-center gap-2.5 pb-2.5 mb-1.5 border-b border-border-subtle shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 transition-transform"
          style={{ backgroundColor: `${color}14`, border: `1px solid ${color}30` }}>
          <span className={loading ? 'animate-pulse' : ''}>{FACE[face]}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary leading-tight">{persona.name}</p>
          <p className="text-[11px] leading-tight" style={{ color }}>{STATUS[face]}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
              style={{ backgroundColor: `${color}14`, border: `1px solid ${color}30` }}>
              {persona.emoji}
            </div>
            <p className="text-sm text-text-secondary max-w-[280px] leading-relaxed">{persona.greeting}</p>
            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              {persona.suggestions.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border text-text-secondary hover:text-text-primary transition"
                  style={{ borderColor: `${color}30` }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence>
          {messages.map(msg => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${color}10`, border: `1px solid ${color}15` }}>
                  <Icon size={11} style={{ color }} />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-black/[0.05] text-text-primary'
                  : 'bg-bg-card border border-border-subtle text-text-secondary'}`}>
                {msg.role === 'assistant' ? (
                  <div className="markdown-msg whitespace-normal">
                    <ReactMarkdown
                      components={{
                        // Tighten default markdown spacing for chat bubbles
                        h1: ({ children }) => <h3 className="text-base font-semibold text-text-primary mt-2 mb-1">{children}</h3>,
                        h2: ({ children }) => <h3 className="text-base font-semibold text-text-primary mt-2 mb-1">{children}</h3>,
                        h3: ({ children }) => <h4 className="text-sm font-semibold text-text-primary mt-2 mb-1">{children}</h4>,
                        h4: ({ children }) => <p className="text-sm font-semibold text-text-primary mt-2 mb-1">{children}</p>,
                        p:  ({ children }) => <p className="my-1 whitespace-pre-wrap">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-5 my-1 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-5 my-1 space-y-0.5">{children}</ol>,
                        li: ({ children }) => <li className="leading-snug">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        code: ({ children }) => <code className="px-1 rounded bg-black/[0.05] font-mono text-[0.85em]">{children}</code>,
                        a: ({ href, children }) => <a href={href} className="text-accent underline" target="_blank" rel="noreferrer">{children}</a>,
                        hr: () => <hr className="my-2 border-border-subtle" />,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/40 pl-3 my-1 italic text-text-muted">{children}</blockquote>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}10`, border: `1px solid ${color}15` }}>
              <Icon size={11} style={{ color }} />
            </div>
            <div className="bg-bg-card border border-border-subtle rounded-2xl px-3.5 py-2.5 flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Standardized medical disclaimer — required across every AI agent surface. */}
      <div className="mt-3 pt-3 border-t border-border-subtle flex items-start gap-2 text-[11px] leading-snug text-text-muted">
        <Info size={11} className="text-text-muted shrink-0 mt-0.5" />
        <p>
          AI guidance — not medical advice. For emergencies call <strong>988</strong> (US Suicide &amp; Crisis), <strong>911</strong> / your local emergency number.
        </p>
      </div>

      <div className="flex items-center gap-2 mt-3">
        {hasToken === false ? (
          // Logged-out: full-width "Connect to chat" CTA replaces the input
          <button onClick={goToLogin}
            className="flex-1 h-11 rounded-full bg-accent text-white text-sm font-semibold shadow shadow-accent/30 hover:bg-accent-hover transition flex items-center justify-center gap-2 active:scale-[0.98]">
            Connect wallet to chat
            <Send size={14} />
          </button>
        ) : (
          <>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              onFocus={() => { if (!localStorage.getItem('token')) goToLogin(); }}
              placeholder="Type a message..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="send"
              style={{ fontSize: '16px' }}
              className="flex-1 bg-bg-card border border-border rounded-full px-4 py-3 sm:text-sm text-text-primary placeholder-text-muted min-h-[44px]" />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-full bg-text-primary text-bg flex items-center justify-center disabled:opacity-20 shrink-0 hover:bg-accent transition-colors duration-200">
              <Send size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
