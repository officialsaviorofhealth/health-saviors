'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Apple, Plus, Flame, TrendingUp, Sparkles, Droplets, Trash2, Pencil, Check, X, RefreshCw } from 'lucide-react';
import AgentChat from '@/components/AgentChat';
import { AgentHero } from '@/components/ui/AgentHero';
import { useToast, ToastStack } from '@/components/ui/Toast';

const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };
const NUTRITIONIST = '#f59e0b';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: '🍳', window: '6–10am' },
  { id: 'lunch', label: 'Lunch', icon: '🍝', window: '12–2pm' },
  { id: 'dinner', label: 'Dinner', icon: '🍽', window: '6–9pm' },
  { id: 'snack', label: 'Snack', icon: '🍪', window: 'Anytime' },
];

interface Meal {
  id: string;
  mealType: string;
  description: string;
  calories: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  createdAt?: string;
  _pending?: boolean; // true while POST is in flight (optimistic)
  _failed?: boolean;  // true if the POST failed
}

export default function NutritionLabPage() {
  const [token, setToken] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealType, setMealType] = useState('lunch');
  const [mealDesc, setMealDesc] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [mealLoading, setMealLoading] = useState(false);
  const [waterMl, setWaterMl] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [waterLoading, setWaterLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editType, setEditType] = useState('lunch');
  const [editBusy, setEditBusy] = useState(false);
  const { messages, push } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) { loadToday(t); loadWeekly(t); loadWater(t); }
  }, []);

  // Listen for chat-driven meal logs (AI Nutritionist auto-logs from conversation)
  useEffect(() => {
    if (!token) return;
    const onUpdate = (e: any) => {
      const type = e?.detail?.type;
      if (type === 'meal') {
        loadToday(token);
        loadWeekly(token);
        const items = e?.detail?.items || [];
        if (items.length > 0) {
          const totalKcal = items.reduce((s: number, m: any) => s + (m.calories || 0), 0);
          push({
            title: `Auto-logged from chat`,
            subtitle: `${items.length} item${items.length === 1 ? '' : 's'}${totalKcal > 0 ? ` · ${totalKcal} kcal` : ''}`,
            accent: NUTRITIONIST,
          });
        }
      } else if (type === 'water') {
        loadWater(token);
      }
    };
    window.addEventListener('healthLog:updated', onUpdate);
    return () => window.removeEventListener('healthLog:updated', onUpdate);
  }, [token]);

  // Derived totals — recalculated on every render so optimistic items count too
  const totalCalories = meals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const calPercent = Math.min((totalCalories / 2000) * 100, 100);
  const mealsByType: Record<string, Meal[]> = {
    breakfast: meals.filter(m => m.mealType === 'breakfast'),
    lunch: meals.filter(m => m.mealType === 'lunch'),
    dinner: meals.filter(m => m.mealType === 'dinner'),
    snack: meals.filter(m => m.mealType === 'snack'),
  };
  const weekAvg = weeklyData.length > 0 ? Math.round(weeklyData.reduce((s, d) => s + d.calories, 0) / weeklyData.length) : 0;

  const headers = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

  function handleAuthError() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    push({ title: 'Session expired', subtitle: 'Redirecting to login…', accent: '#ef4444' });
    setTimeout(() => { window.location.href = '/login'; }, 1200);
  }

  async function loadToday(t: string) {
    const res = await fetch('/api/logs/meal', { headers: headers(t) });
    if (res.status === 401) return handleAuthError();
    const data = await res.json().catch(() => ({}));
    setMeals(data.logs || []);
  }

  async function loadWeekly(t: string) {
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const d = date.toISOString().split('T')[0];
      const data = await fetch(`/api/logs/meal?date=${d}`, { headers: headers(t) }).then(r => r.json()).catch(() => ({}));
      days.push({ date: date.toLocaleDateString('en', { weekday: 'short' }), calories: data.totalCalories || 0, count: data.logs?.length || 0 });
    }
    setWeeklyData(days);
  }

  async function loadWater(t: string) {
    const data = await fetch('/api/logs/water', { headers: headers(t) }).then(r => r.json()).catch(() => ({}));
    setWaterMl(data.totalMl || 0);
    setWaterCount(data.logs?.length || 0);
  }

  async function addWater() {
    if (!token || waterLoading) return;
    setWaterLoading(true);
    const data = await fetch('/api/logs/water', { method: 'POST', headers: headers(token), body: JSON.stringify({ amountMl: 250 }) }).then(r => r.json());
    const reachedGoal = data.totalMl >= 2000 && waterMl < 2000;
    setWaterMl(data.totalMl);
    setWaterCount(c => c + 1);
    setWaterLoading(false);
    push({
      title: '+250ml water logged',
      subtitle: reachedGoal ? '2L goal reached — bonus unlocked.' : `Today: ${data.totalMl}ml of 2,000ml goal.`,
      points: data.awarded || (reachedGoal ? 50 : 10),
      accent: '#3b82f6',
    });
  }

  async function addMeal() {
    if (mealLoading) return;
    if (!token) {
      push({ title: 'Login required', subtitle: 'Connect your wallet to log meals.', accent: NUTRITIONIST });
      return;
    }
    if (!mealDesc.trim()) return;

    const desc = mealDesc.trim();
    const type = mealType;
    const tempId = `temp-${Date.now()}`;

    // 1) Optimistic insert — show meal in the list IMMEDIATELY
    const optimistic: Meal = {
      id: tempId,
      mealType: type,
      description: desc,
      calories: null,
      _pending: true,
    };
    setMeals(prev => [...prev, optimistic]);
    setMealDesc('');
    setShowForm(false);
    setMealLoading(true);

    try {
      const res = await fetch('/api/logs/meal', {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ mealType: type, description: desc }),
      });

      if (res.status === 401) {
        setMeals(prev => prev.filter(m => m.id !== tempId));
        return handleAuthError();
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.log) {
        // Mark optimistic entry as failed (keep in list with retry button)
        setMeals(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
        push({
          title: 'Save failed',
          subtitle: data.error || `Server returned ${res.status}.`,
          accent: '#ef4444',
        });
        return;
      }

      // 2) Replace optimistic item with the real server-saved one (with calories)
      setMeals(prev => prev.map(m => m.id === tempId ? { ...data.log, _pending: false } : m));
      loadWeekly(token); // chart in background

      push({
        title: `${MEAL_TYPES.find(m => m.id === type)?.label} saved`,
        subtitle: data.log.calories
          ? `${data.log.calories} kcal · P${data.log.protein || 0}g · C${data.log.carbs || 0}g · F${data.log.fat || 0}g`
          : 'Saved. Calories will appear shortly.',
        points: data.awarded || 30,
        accent: NUTRITIONIST,
      });
    } catch (err: any) {
      console.error('addMeal error:', err);
      setMeals(prev => prev.map(m => m.id === tempId ? { ...m, _pending: false, _failed: true } : m));
      push({
        title: 'Network error',
        subtitle: err?.message || 'Could not reach the server.',
        accent: '#ef4444',
      });
    } finally {
      setMealLoading(false);
    }
  }

  function startEdit(m: Meal) {
    setEditingId(m.id);
    setEditText(m.description);
    setEditType(m.mealType);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  async function saveEdit(id: string) {
    if (!token || editBusy || !editText.trim()) return;
    const original = meals.find(m => m.id === id);
    if (!original) return;
    const newDesc = editText.trim();
    const newType = editType;
    const reestimate = newDesc !== original.description || newType !== original.mealType;

    setEditBusy(true);
    // Optimistic: clear calories if re-estimating so user sees it's recalculating
    setMeals(prev => prev.map(m => m.id === id ? {
      ...m,
      description: newDesc,
      mealType: newType,
      calories: reestimate ? null : m.calories,
      _pending: reestimate,
    } : m));

    try {
      const res = await fetch(`/api/logs/meal/${id}`, {
        method: 'PATCH',
        headers: headers(token),
        body: JSON.stringify({ description: newDesc, mealType: newType, reestimate }),
      });
      if (res.status === 401) return handleAuthError();
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.log) {
        // Revert
        setMeals(prev => prev.map(m => m.id === id ? original : m));
        push({ title: 'Edit failed', subtitle: data.error || 'Try again.', accent: '#ef4444' });
        return;
      }
      setMeals(prev => prev.map(m => m.id === id ? { ...data.log, _pending: false } : m));
      loadWeekly(token);
      push({
        title: 'Meal updated',
        subtitle: reestimate
          ? `Recalculated: ${data.log.calories || '—'} kcal`
          : 'Saved.',
        accent: NUTRITIONIST,
      });
      setEditingId(null);
    } catch (err: any) {
      setMeals(prev => prev.map(m => m.id === id ? original : m));
      push({ title: 'Network error', subtitle: err?.message, accent: '#ef4444' });
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteMeal(id: string) {
    if (!token) return;
    const target = meals.find(m => m.id === id);
    if (!target) return;
    // Optimistic remove
    setMeals(prev => prev.filter(m => m.id !== id));
    try {
      // Skip API for failed-only optimistic entries (they were never saved)
      if (id.startsWith('temp-')) return;
      const res = await fetch(`/api/logs/meal/${id}`, { method: 'DELETE', headers: headers(token) });
      if (res.status === 401) {
        setMeals(prev => [...prev, target].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
        return handleAuthError();
      }
      if (!res.ok) {
        setMeals(prev => [...prev, target].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
        push({ title: 'Delete failed', subtitle: 'Restored. Try again.', accent: '#ef4444' });
        return;
      }
      loadWeekly(token);
      push({ title: 'Meal removed', subtitle: target.description, accent: NUTRITIONIST });
    } catch {
      setMeals(prev => [...prev, target].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')));
      push({ title: 'Network error', subtitle: 'Restored.', accent: '#ef4444' });
    }
  }

  async function retryMeal(m: Meal) {
    if (!token) return;
    setMeals(prev => prev.map(x => x.id === m.id ? { ...x, _pending: true, _failed: false } : x));
    try {
      const res = await fetch('/api/logs/meal', {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ mealType: m.mealType, description: m.description }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.log) {
        setMeals(prev => prev.map(x => x.id === m.id ? { ...x, _pending: false, _failed: true } : x));
        push({ title: 'Retry failed', subtitle: data.error || 'Try again.', accent: '#ef4444' });
        return;
      }
      setMeals(prev => prev.map(x => x.id === m.id ? { ...data.log, _pending: false } : x));
      loadWeekly(token);
    } catch {
      setMeals(prev => prev.map(x => x.id === m.id ? { ...x, _pending: false, _failed: true } : x));
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      <ToastStack messages={messages} />
      {!token && (
        <div className="mb-6 rounded-2xl glass px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Preview mode — connect to log meals and earn H2E.</p>
          <a href="/login" className="text-xs font-medium text-accent hover:text-text-primary transition-colors">Connect →</a>
        </div>
      )}

      <AgentHero
        eyebrow="Agent · 03"
        title="Nutrition Lab"
        titleAccent="."
        description="Type what you ate. AI Nutritionist estimates calories, macros, and gaps in real time — and turns the week into a personalized plan."
        accentColor={NUTRITIONIST}
        icon={<Apple size={20} className="text-agent-nutritionist" />}
        stats={[
          { label: 'Today', value: `${totalCalories}` },
          { label: '7-day avg', value: `${weekAvg}` },
        ]}
      />

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 sm:gap-6">
        {/* Left column */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">

          {/* Calories ring + progress */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-sm text-text-secondary uppercase tracking-wider">Today's calories</span>
                </div>
                <p className="font-display text-5xl text-text-primary">{totalCalories}<span className="text-xl text-text-secondary"> kcal</span></p>
                <p className="text-sm text-text-muted mt-1">of 2,000 daily goal</p>
              </div>
              <button onClick={() => { setShowForm(s => !s); setTimeout(() => inputRef.current?.focus(), 0); }}
                className="px-5 py-3 rounded-full bg-agent-nutritionist text-white text-sm font-semibold shadow-md shadow-agent-nutritionist/30 hover:bg-agent-nutritionist/90 transition-all flex items-center gap-2 active:scale-[0.98]">
                <Plus size={14} /> Log meal
              </button>
            </div>
            <div className="w-full h-2.5 bg-black/[0.03] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-agent-nutritionist to-orange-300 rounded-full transition-all duration-700" style={{ width: `${calPercent}%` }} />
            </div>

            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="mt-5 pt-5 border-t border-border-subtle space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {MEAL_TYPES.map(t => (
                        <button key={t.id} onClick={() => setMealType(t.id)}
                          className={`p-3 rounded-xl text-left transition-all ${mealType === t.id ? 'bg-agent-nutritionist/15 border border-agent-nutritionist/40' : 'glass-subtle hover:bg-black/[0.06] border border-border-subtle'}`}>
                          <span className="text-xl block">{t.icon}</span>
                          <p className={`text-sm font-medium mt-1 ${mealType === t.id ? 'text-agent-nutritionist' : 'text-text-primary'}`}>{t.label}</p>
                          <p className="text-[10px] text-text-muted">{t.window}</p>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">Describe naturally — multiple items separated by commas work too.</p>
                      <div className="flex gap-2">
                        <input ref={inputRef} value={mealDesc} onChange={e => setMealDesc(e.target.value)}
                          placeholder="e.g. grilled chicken salad, pasta with tomato sauce"
                          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMeal(); } }}
                          autoFocus
                          className="flex-1 bg-bg-card border border-border rounded-xl px-4 py-3 text-base text-text-primary placeholder-text-muted focus:outline-none focus:border-agent-nutritionist/60" />
                        <button onClick={addMeal} disabled={!mealDesc.trim() || mealLoading}
                          className="px-6 py-3 rounded-xl bg-agent-nutritionist text-white text-base font-semibold shadow-md shadow-agent-nutritionist/30 disabled:opacity-30 disabled:shadow-none active:scale-[0.98] flex items-center gap-2 whitespace-nowrap">
                          {mealLoading
                            ? (<><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Saving</>)
                            : (<><Sparkles size={14} /> Save</>)}
                        </button>
                      </div>
                      <p className="text-[11px] text-text-muted">Press <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] border border-border-subtle text-[10px] font-mono">Enter</kbd> to save · AI estimates calories (3–8s)</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hydration — synced with Wellness */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Droplets size={18} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-base font-medium text-text-primary">Hydration</p>
                  <p className="text-xs text-text-muted">Synced with Wellness · +10 H2E per cup</p>
                </div>
              </div>
              <button onClick={addWater} disabled={waterLoading || !token}
                className="px-5 py-3 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-500 hover:bg-blue-500/20 disabled:opacity-40 transition-all text-sm font-medium flex items-center gap-2 active:scale-[0.98]">
                {waterLoading ? <span className="inline-block w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /> : <><Plus size={14} /> 250ml cup</>}
              </button>
            </div>
            <div className="flex items-baseline gap-2 mb-3">
              <p className="font-display text-4xl text-text-primary">{(waterMl / 1000).toFixed(1)}<span className="text-xl text-text-secondary">L</span></p>
              <span className="text-sm text-text-muted">/ 2.0L · {waterCount} cups</span>
            </div>
            <div className="w-full h-2 bg-black/[0.03] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700" style={{ width: `${Math.min(waterMl / 2000 * 100, 100)}%` }} />
            </div>
            {waterMl >= 2000 && <p className="text-sm text-agent-nurse mt-3">✓ Daily hydration goal reached.</p>}
          </div>

          {/* Meals by type */}
          <div className="card p-6">
            <h3 className="text-base font-medium text-text-primary mb-4">Today's meals</h3>
            <div className="space-y-4">
              {MEAL_TYPES.map(type => {
                const typeMeals = mealsByType[type.id];
                const typeKcal = typeMeals.reduce((s, m) => s + (m.calories || 0), 0);
                return (
                  <div key={type.id} className="border-t border-border-subtle pt-4 first:border-0 first:pt-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{type.icon}</span>
                        <span className="text-sm font-medium text-text-primary">{type.label}</span>
                        <span className="text-xs text-text-muted">{typeMeals.length > 0 ? `· ${typeMeals.length} item${typeMeals.length === 1 ? '' : 's'}` : ''}</span>
                      </div>
                      {typeKcal > 0 && <span className="text-sm text-text-secondary font-mono">{typeKcal} kcal</span>}
                    </div>
                    {typeMeals.length > 0 ? (
                      <ul className="space-y-1.5 ml-7">
                        <AnimatePresence initial={false}>
                          {typeMeals.map(m => (
                            <motion.li key={m.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 8, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="group">
                              {editingId === m.id ? (
                                <div className="flex items-center gap-2 py-1">
                                  <select value={editType} onChange={e => setEditType(e.target.value)}
                                    className="text-xs bg-bg-card border border-border rounded px-1.5 py-1 focus:outline-none">
                                    {MEAL_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon}</option>)}
                                  </select>
                                  <input value={editText} onChange={e => setEditText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(m.id); } if (e.key === 'Escape') cancelEdit(); }}
                                    autoFocus
                                    className="flex-1 text-sm bg-bg-card border border-border rounded px-2 py-1 focus:outline-none focus:border-agent-nutritionist/60" />
                                  <button onClick={() => saveEdit(m.id)} disabled={editBusy || !editText.trim()}
                                    className="p-1.5 rounded text-agent-nutritionist hover:bg-agent-nutritionist/10 disabled:opacity-40 transition" title="Save">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={cancelEdit} className="p-1.5 rounded text-text-muted hover:bg-black/[0.05] transition" title="Cancel">
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-sm gap-2">
                                  <span className={`flex-1 truncate ${m._failed ? 'text-red-500' : 'text-text-secondary'}`}>
                                    {m.description}
                                    {m._pending && <span className="ml-2 text-[10px] uppercase tracking-wider text-agent-nutritionist animate-pulse">estimating…</span>}
                                    {m._failed && <span className="ml-2 text-[10px] uppercase tracking-wider text-red-500">failed</span>}
                                  </span>
                                  <span className="flex items-center gap-1 shrink-0">
                                    {m.calories != null && (
                                      <span className="text-text-muted font-mono text-xs">{m.calories} kcal</span>
                                    )}
                                    {m._pending && (
                                      <span className="w-3 h-3 border-2 border-agent-nutritionist/30 border-t-agent-nutritionist rounded-full animate-spin" />
                                    )}
                                    {m._failed && (
                                      <button onClick={() => retryMeal(m)}
                                        className="p-1 rounded text-red-500 hover:bg-red-500/10 transition" title="Retry">
                                        <RefreshCw size={12} />
                                      </button>
                                    )}
                                    {!m._pending && !m._failed && (
                                      <button onClick={() => startEdit(m)}
                                        className="p-1 rounded text-text-muted hover:text-agent-nutritionist hover:bg-agent-nutritionist/10 transition opacity-0 group-hover:opacity-100" title="Edit">
                                        <Pencil size={12} />
                                      </button>
                                    )}
                                    <button onClick={() => deleteMeal(m.id)}
                                      className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100" title="Delete">
                                      <Trash2 size={12} />
                                    </button>
                                  </span>
                                </div>
                              )}
                            </motion.li>
                          ))}
                        </AnimatePresence>
                      </ul>
                    ) : (
                      <p className="text-sm text-text-muted ml-7 italic">Not logged yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly chart */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-agent-nutritionist" />
                <h3 className="text-base font-medium text-text-primary">Last 7 days</h3>
              </div>
              <span className="text-sm text-text-muted">avg <span className="text-text-primary font-mono">{weekAvg}</span> kcal</span>
            </div>
            <div className="flex items-end gap-2 h-28">
              {weeklyData.map((d, i) => {
                const h = Math.max((d.calories / 2500) * 100, 4);
                const isToday = i === weeklyData.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity font-mono">{d.calories}</span>
                    <div className={`w-full rounded-md transition-all ${isToday ? 'bg-agent-nutritionist' : 'bg-agent-nutritionist/30 group-hover:bg-agent-nutritionist/50'}`} style={{ height: `${h}%` }} />
                    <span className="text-[10px] text-text-muted">{d.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* AI Chat */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card p-5 flex flex-col h-[640px] max-h-[80vh]">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-subtle shrink-0">
            <div className="w-9 h-9 rounded-xl bg-agent-nutritionist/10 border border-agent-nutritionist/20 flex items-center justify-center">
              <Apple size={16} className="text-agent-nutritionist" />
            </div>
            <div>
              <p className="text-base font-medium text-text-primary">AI Nutritionist</p>
              <p className="text-[11px] text-text-muted">Ask "what should I eat for dinner?" — knows your day.</p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <AgentChat agentType="nutritionist" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
