'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Brain, Play, Pause, RotateCcw, Check, Smile, ExternalLink, X, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { AgentHero } from '@/components/ui/AgentHero';
import { useToast, ToastStack } from '@/components/ui/Toast';
import AgentChat from '@/components/AgentChat';

const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };
const MOODS = [
  { emoji: '😫', label: 'Awful', tip: 'Gentle breathwork will help — Mind Care is here.' },
  { emoji: '😟', label: 'Low', tip: 'A 5-min body scan can reset your nervous system.' },
  { emoji: '😐', label: 'Okay', tip: 'Small rituals compound — try a 10-min session.' },
  { emoji: '🙂', label: 'Good', tip: 'Lock in with guided meditation or gratitude.' },
  { emoji: '😄', label: 'Great', tip: 'Capture the moment — journaling boosts streaks.' },
];
const MINDCARE = '#a855f7';

const SESSION_TYPES = [
  { id: 'breathing', label: 'Breathing', duration: 5 },
  { id: 'body_scan', label: 'Body Scan', duration: 10 },
  { id: 'guided', label: 'Guided', duration: 15 },
  { id: 'free', label: 'Free', duration: 10 },
];

const BREATHING_GUIDE = ['Breathe in', 'Hold', 'Breathe out', 'Hold'];
const BODY_SCAN_CUES = [
  'Settle in. Let your body relax.',
  'Feel the top of your head.',
  'Soften your forehead and jaw.',
  'Release your shoulders.',
  'Let your chest rise and fall.',
  'Notice your belly. Let it soften.',
  'Feel your arms becoming heavy.',
  'Relax your hands and fingers.',
  'Let your hips sink down.',
  'Soften your legs, knees, feet.',
  'You are completely at ease.',
];
const GUIDED_CUES = [
  'Close your eyes. Take a slow, deep breath.',
  'Notice the air entering your nose.',
  'Let your thoughts drift without judgment.',
  'Return your attention to the breath.',
  'With each exhale, release a little tension.',
  'You are safe. You are present.',
  'Breathe in calm. Breathe out worry.',
  'Feel your heart beating, steady and strong.',
];

function speak(text: string, enabled: boolean) {
  if (!enabled) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 0.95;
    u.volume = 0.9;
    const voices = synth.getVoices();
    const preferred = voices.find(v => /en.*(female|Samantha|Karen|Moira|Victoria)/i.test(v.name + v.lang))
      || voices.find(v => v.lang?.startsWith('en'));
    if (preferred) u.voice = preferred;
    synth.speak(u);
  } catch {}
}

// Content loaded from API

export default function MindSpacePage() {
  const [token, setToken] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [moodLoading, setMoodLoading] = useState(false);
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [randomContent, setRandomContent] = useState<any[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(SESSION_TYPES[0]);
  const [timerMin, setTimerMin] = useState(5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [todayMedMin, setTodayMedMin] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [immersive, setImmersive] = useState(false); // optional fullscreen mode
  const intervalRef = useRef<any>(null);
  const breathRef = useRef<any>(null);
  const countdownRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [cueIndex, setCueIndex] = useState(0);
  const cueRef = useRef<any>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [autoShuffle, setAutoShuffle] = useState(true);
  const shuffleRef = useRef<any>(null);
  const { messages: toastMessages, push: pushToast } = useToast();

  // Create alarm sound using Web Audio API
  function playAlarm() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      // 3-tone chime: C5 → E5 → G5
      playTone(523, 0, 0.6);
      playTone(659, 0.3, 0.6);
      playTone(784, 0.6, 0.8);
    } catch {}
  }

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    if (t) loadData(t);
    loadContent();
    return () => { clearInterval(intervalRef.current); clearInterval(breathRef.current); clearInterval(shuffleRef.current); };
  }, []);

  // Auto-shuffle recommended videos every 45s while not actively watching
  useEffect(() => {
    clearInterval(shuffleRef.current);
    if (autoShuffle && !activeVideoId) {
      shuffleRef.current = setInterval(() => { loadContent(); }, 45000);
    }
    return () => clearInterval(shuffleRef.current);
  }, [autoShuffle, activeVideoId]);

  const headers = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

  async function loadContent() {
    setContentLoading(true);
    try {
      const res = await fetch('/api/youtube?count=6');
      const data = await res.json();
      setRandomContent(data.results || []);
    } catch {}
    setContentLoading(false);
  }

  async function loadData(t: string) {
    const [moodRes, medRes, weekRes] = await Promise.all([
      fetch('/api/logs/mood', { headers: headers(t) }).then(r => r.json()),
      fetch('/api/logs/meditation', { headers: headers(t) }).then(r => r.json()),
      fetch('/api/logs/summary?range=week', { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
    ]);
    if (moodRes.logs?.length > 0) setMood(moodRes.logs[0].score);
    setTodayMedMin(medRes.totalMin || 0);
    setMoodHistory(weekRes.mood?.logs || []);
  }

  async function setMoodScore(score: number) {
    if (!token || moodLoading) return;
    setMoodLoading(true);
    const data = await fetch('/api/logs/mood', { method: 'POST', headers: headers(token), body: JSON.stringify({ score }) }).then(r => r.json()).catch(() => ({}));
    setMood(score);
    setMoodLoading(false);
    const m = MOODS[score - 1];
    pushToast({
      title: `Mood: ${m.label} ${m.emoji}`,
      subtitle: m.tip,
      points: data.awarded || 10,
      accent: MINDCARE,
    });
  }

  function beginActualTimer() {
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); clearInterval(breathRef.current); clearInterval(cueRef.current); setRunning(false); setCompleted(true); saveMeditation(); return 0; }
        return prev - 1;
      });
    }, 1000);
    if (selectedType.id === 'breathing') {
      let phase = 0;
      speak(BREATHING_GUIDE[0], voiceOn);
      breathRef.current = setInterval(() => {
        phase = (phase + 1) % 4;
        setBreathPhase(phase);
        speak(BREATHING_GUIDE[phase], voiceOn);
      }, 4000);
    } else if (selectedType.id === 'body_scan' || selectedType.id === 'guided') {
      const cues = selectedType.id === 'body_scan' ? BODY_SCAN_CUES : GUIDED_CUES;
      speak(cues[0], voiceOn);
      let i = 0;
      const intervalMs = Math.max(12000, Math.floor((timerMin * 60 * 1000) / cues.length));
      cueRef.current = setInterval(() => {
        i = (i + 1) % cues.length;
        setCueIndex(i);
        speak(cues[i], voiceOn);
      }, intervalMs);
    }
  }

  function startTimer() {
    // Show overlay with 3-2-1 countdown before the session begins
    clearInterval(countdownRef.current);
    setTimeLeft(timerMin * 60);
    setRunning(true); setCompleted(false); setBreathPhase(0); setCueIndex(0);
    setCountdown(3);
    speak('Three', voiceOn);
    let n = 3;
    countdownRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        beginActualTimer();
      } else {
        setCountdown(n);
        speak(n === 2 ? 'Two' : 'One', voiceOn);
      }
    }, 1000);
  }

  function togglePause() {
    if (running) {
      clearInterval(intervalRef.current); clearInterval(breathRef.current); clearInterval(cueRef.current); clearInterval(countdownRef.current);
      try { window.speechSynthesis?.cancel(); } catch {}
      setCountdown(null);
      setRunning(false);
    } else if (timeLeft > 0) {
      // Resume mid-session: skip countdown, just continue
      setRunning(true);
      beginActualTimer();
    }
  }
  function resetTimer() {
    clearInterval(intervalRef.current); clearInterval(breathRef.current); clearInterval(cueRef.current); clearInterval(countdownRef.current);
    try { window.speechSynthesis?.cancel(); } catch {}
    setRunning(false); setCompleted(false); setTimeLeft(0); setCueIndex(0); setCountdown(null); setImmersive(false);
  }

  async function saveMeditation() {
    if (!token) return;
    playAlarm();
    setSaving(true);
    setSaved(false);
    const data = await fetch('/api/logs/meditation', { method: 'POST', headers: headers(token), body: JSON.stringify({ durationMin: timerMin, sessionType: selectedType.id }) }).then(r => r.json()).catch(() => ({}));
    setTodayMedMin(prev => prev + timerMin);
    setSaving(false);
    setSaved(true);
    pushToast({
      title: `${selectedType.label} · ${timerMin} min complete`,
      subtitle: 'Session saved. Keep a daily streak — Mind Care will trend your focus over the week.',
      points: data.awarded || 40,
      accent: MINDCARE,
    });
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const currentCue = selectedType.id === 'breathing'
    ? BREATHING_GUIDE[breathPhase]
    : selectedType.id === 'body_scan'
    ? BODY_SCAN_CUES[cueIndex % BODY_SCAN_CUES.length]
    : selectedType.id === 'guided'
    ? GUIDED_CUES[cueIndex % GUIDED_CUES.length]
    : '';

  return (
    <>
    {/* Floating meditation widget — non-blocking, lets user keep playing videos below */}
    {running && !immersive && (
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed z-[60] bottom-4 right-4 sm:bottom-6 sm:right-6 w-[300px] sm:w-[340px] rounded-3xl overflow-hidden shadow-2xl shadow-agent-mindcare/25 border border-agent-mindcare/30"
        style={{ background: 'linear-gradient(155deg, #1a0b2e 0%, #2d1b4e 60%, #1f1235 100%)' }}
      >
        {/* Ambient glow */}
        <div className="absolute -top-16 -right-16 w-[220px] h-[220px] rounded-full bg-agent-mindcare/30 blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 pt-3 pb-2">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-agent-mindcare/90">{selectedType.label}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => { setVoiceOn(v => !v); if (voiceOn) try { window.speechSynthesis?.cancel(); } catch {} }}
              className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-white/80 transition" title="Voice">
              {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button onClick={() => setImmersive(true)}
              className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-white/80 transition" title="Expand">
              <Maximize2 size={12} />
            </button>
            <button onClick={resetTimer}
              className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.16] flex items-center justify-center text-white/80 transition" title="End session">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="relative px-4 pb-4">
          {countdown !== null ? (
            <div className="flex flex-col items-center py-3">
              <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/50 mb-1">Get ready</p>
              <motion.p
                key={countdown}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.4 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="font-extralight text-white select-none"
                style={{ fontSize: '88px', lineHeight: 1, textShadow: '0 0 50px rgba(168,85,247,0.55)' }}
              >
                {countdown}
              </motion.p>
              <p className="mt-2 text-[11px] text-white/55 tracking-wide">Settle in…</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Mini pulse ring + timer */}
              <motion.div
                key={selectedType.id === 'breathing' ? breathPhase : 'idle'}
                initial={{ scale: 1 }}
                animate={{
                  scale: selectedType.id === 'breathing'
                    ? (breathPhase === 0 ? 1.12 : breathPhase === 2 ? 0.88 : 1)
                    : [1, 1.05, 1],
                }}
                transition={{
                  duration: selectedType.id === 'breathing' ? 4 : 6,
                  ease: 'easeInOut',
                  repeat: selectedType.id === 'breathing' ? 0 : Infinity,
                }}
                className="relative w-[88px] h-[88px] rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(168,85,247,0.12) 60%, transparent 100%)' }}
              >
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - (timeLeft > 0 ? timeLeft / (timerMin * 60) : 1))}`}
                    className="transition-all duration-1000" />
                </svg>
                <p className="text-base font-extralight text-white font-mono tabular-nums">{formatTime(timeLeft)}</p>
              </motion.div>

              <div className="flex-1 min-w-0">
                <motion.p
                  key={currentCue + cueIndex + breathPhase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-sm font-light text-white/85 leading-snug line-clamp-3"
                >
                  {currentCue || 'Breathe naturally.'}
                </motion.p>
                <button onClick={togglePause}
                  className="mt-3 px-3 py-1.5 rounded-full bg-agent-mindcare hover:bg-agent-mindcare/90 text-white text-xs font-medium flex items-center gap-1.5 active:scale-95 transition shadow-lg shadow-agent-mindcare/40">
                  <Pause size={11} /> Pause
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    )}

    {/* Optional immersive fullscreen mode (only when user clicks expand) */}
    {running && immersive && (
      <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-agent-mindcare/10 blur-[160px] animate-pulse" style={{ animationDuration: '4s' }} />
        </div>

        <div className="absolute top-5 right-5 flex items-center gap-2 z-10">
          <button onClick={() => { setVoiceOn(v => !v); if (voiceOn) try { window.speechSynthesis?.cancel(); } catch {} }}
            className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition">
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button onClick={() => setImmersive(false)}
            className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition" title="Minimize">
            <Minimize2 size={18} />
          </button>
          <button onClick={resetTimer}
            className="w-11 h-11 rounded-full bg-white/[0.08] border border-white/[0.12] flex items-center justify-center text-white/80 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <p className="text-[10px] font-mono tracking-[0.24em] uppercase text-agent-mindcare">{selectedType.label}</p>
        </div>

        {countdown !== null && (
          <div className="relative z-10 flex flex-col items-center">
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/55 mb-6">Get ready</p>
            <motion.p key={countdown} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="font-extralight text-agent-mindcare select-none"
              style={{ fontSize: 'clamp(160px, 32vw, 280px)', lineHeight: 1, textShadow: '0 0 80px rgba(168,85,247,0.4)' }}>
              {countdown}
            </motion.p>
            <p className="mt-8 text-base text-white/70 font-light tracking-wide">Settle in. Breathing begins shortly.</p>
          </div>
        )}

        {countdown === null && (
        <div className="relative z-10 flex flex-col items-center">
          <motion.div key={selectedType.id === 'breathing' ? breathPhase : 'idle'}
            initial={{ scale: selectedType.id === 'breathing' && (breathPhase === 0) ? 0.7 : 1 }}
            animate={{
              scale: selectedType.id === 'breathing'
                ? (breathPhase === 0 ? 1.25 : breathPhase === 2 ? 0.7 : 1)
                : [1, 1.08, 1],
            }}
            transition={{ duration: selectedType.id === 'breathing' ? 4 : 6, ease: 'easeInOut', repeat: selectedType.id === 'breathing' ? 0 : Infinity }}
            className="relative w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(168,85,247,0.05) 60%, transparent 100%)' }}>
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="56" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
              <circle cx="60" cy="60" r="56" fill="none" stroke="#a855f7" strokeWidth="1.2" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - (timeLeft > 0 ? timeLeft / (timerMin * 60) : 1))}`}
                className="transition-all duration-1000" />
            </svg>
            <p className="text-5xl sm:text-6xl font-extralight text-white font-mono tracking-tight">{formatTime(timeLeft)}</p>
          </motion.div>

          <motion.p key={currentCue + cueIndex + breathPhase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
            className="mt-10 text-xl sm:text-2xl font-light text-agent-mindcare/90 text-center max-w-md px-6 tracking-wide">
            {currentCue || 'Breathe naturally.'}
          </motion.p>
        </div>
        )}

        {countdown === null && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button onClick={togglePause}
              className="w-16 h-16 rounded-full bg-agent-mindcare flex items-center justify-center active:scale-95 transition-transform shadow-2xl shadow-agent-mindcare/30">
              <Pause size={22} className="text-white" />
            </button>
          </div>
        )}
      </div>
    )}

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-12">
      <ToastStack messages={toastMessages} />
      {!token && (
        <div className="mb-6 rounded-2xl glass px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Preview mode — connect to save sessions and track mood.</p>
          <a href="/login" className="text-xs font-medium text-accent hover:text-text-primary transition-colors">Connect →</a>
        </div>
      )}

      <AgentHero
        eyebrow="Agent · 04"
        title="Mind Space"
        titleAccent="."
        description="A quiet room for your mind. Track mood, meditate with voice guidance, and let AI Mind Care surface what your week is telling you."
        accentColor={MINDCARE}
        icon={<Brain size={20} className="text-agent-mindcare" />}
        stats={[
          { label: 'Today', value: `${todayMedMin}m` },
          { label: 'Mood', value: mood ? MOODS[mood - 1].emoji : '—' },
        ]}
      />

      <div className="grid lg:grid-cols-[360px_1fr] gap-4 sm:gap-6">
        {/* Left Panel */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
          {/* Mood */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-agent-mindcare/10 border border-agent-mindcare/20 flex items-center justify-center">
                  <Smile size={16} className="text-agent-mindcare" />
                </div>
                <div>
                  <p className="text-base font-medium text-text-primary">How are you feeling?</p>
                  <p className="text-[11px] text-text-muted">Tap once · +10 H2E · personalizes Mind Care</p>
                </div>
              </div>
              {moodLoading && <span className="w-4 h-4 border-2 border-agent-mindcare/30 border-t-agent-mindcare rounded-full animate-spin" />}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {MOODS.map((m, i) => (
                <button key={i} onClick={() => setMoodScore(i + 1)} disabled={moodLoading}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all
                    ${mood === i + 1 ? 'bg-agent-mindcare/15 border border-agent-mindcare/30 scale-[1.04]' : moodLoading ? 'opacity-40' : 'glass-subtle hover:bg-black/[0.06]'}`}>
                  <span className="text-2xl">{m.emoji}</span>
                  <span className={`text-[10px] tracking-wide ${mood === i + 1 ? 'text-agent-mindcare' : 'text-text-muted'}`}>{m.label}</span>
                </button>
              ))}
            </div>
            {mood !== null && (
              <div className="mt-4 px-4 py-3 rounded-xl glass-subtle">
                <p className="text-sm text-text-secondary leading-relaxed">
                  <span className="text-agent-mindcare font-medium">{MOODS[mood - 1].label}</span> — {MOODS[mood - 1].tip}
                </p>
              </div>
            )}
            {moodHistory.length > 1 && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <p className="text-xs text-text-muted mb-2">This week</p>
                <div className="flex items-center gap-1.5">
                  {moodHistory.slice(-7).map((m: any, i: number) => (
                    <span key={i} className="text-lg">{['', '😫', '😟', '😐', '🙂', '😄'][m.score]}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Meditation Timer */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium text-text-primary">Meditation</p>
              <span className="text-sm text-text-secondary font-mono">{todayMedMin} min today</span>
            </div>

            <div className="flex gap-1 flex-wrap mb-3">
              {SESSION_TYPES.map(t => (
                <button key={t.id} onClick={() => { setSelectedType(t); setTimerMin(t.duration); resetTimer(); }}
                  className={`px-2 py-1 rounded-full text-xs active:scale-[0.98] transition-transform ${selectedType.id === t.id ? 'bg-agent-mindcare/20 text-agent-mindcare border border-agent-mindcare/30' : 'bg-bg-card text-text-secondary border border-border-subtle'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Timer */}
            <div className="flex flex-col items-center py-4">
              {running && selectedType.id === 'breathing' && (
                <motion.p key={breathPhase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-agent-mindcare/80 mb-2">{BREATHING_GUIDE[breathPhase]}</motion.p>
              )}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - (timeLeft > 0 ? timeLeft / (timerMin * 60) : (completed ? 0 : 1)))}`}
                    className="transition-all duration-1000" />
                </svg>
                <span className="text-xl font-light text-text-primary font-mono">
                  {timeLeft > 0 ? formatTime(timeLeft) : completed ? '✓' : formatTime(timerMin * 60)}
                </span>
              </div>

              {!running && !completed && (
                <div className="flex gap-1 mt-3">
                  {[5, 10, 15, 30].map(m => (
                    <button key={m} onClick={() => setTimerMin(m)} className={`px-2.5 py-1 rounded-full text-xs font-mono active:scale-[0.98] transition-transform ${timerMin === m ? 'bg-agent-mindcare/20 text-agent-mindcare' : 'bg-bg-card text-text-secondary'}`}>{m}m</button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-3">
                {!completed ? (
                  <>
                    <button onClick={timeLeft > 0 ? togglePause : startTimer} className="w-10 h-10 rounded-full bg-agent-mindcare flex items-center justify-center active:scale-[0.98] transition-transform">
                      {running ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white ml-0.5" />}
                    </button>
                    {timeLeft > 0 && <button onClick={resetTimer} className="w-10 h-10 rounded-full bg-bg-card flex items-center justify-center active:scale-[0.98] transition-transform"><RotateCcw size={14} className="text-text-secondary" /></button>}
                  </>
                ) : (
                  <div className="text-center space-y-1">
                    <div className="w-10 h-10 rounded-full bg-agent-nurse/20 flex items-center justify-center mx-auto">
                      {saving ? <span className="w-4 h-4 border-2 border-agent-nurse/30 border-t-agent-nurse rounded-full animate-spin" /> : <Check size={16} className="text-agent-nurse" />}
                    </div>
                    <p className="text-xs text-agent-nurse">{saving ? 'Saving...' : 'Session Complete!'}</p>
                    {saved && <p className="text-xs text-text-secondary">{timerMin} min recorded to your log</p>}
                    <button onClick={() => { resetTimer(); setSaved(false); }} className="text-xs text-agent-mindcare hover:text-agent-mindcare/80 mt-1">Start another</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recommended — inline embed player */}
          <div className="card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">Recommended</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setAutoShuffle(v => !v)}
                  className={`text-xs transition-colors ${autoShuffle ? 'text-agent-mindcare' : 'text-text-muted hover:text-text-secondary'}`}>
                  {autoShuffle ? '● Auto' : '○ Auto'}
                </button>
                <button onClick={loadContent} disabled={contentLoading}
                  className="text-xs text-agent-mindcare hover:text-agent-mindcare/80 transition-colors disabled:opacity-50">
                  {contentLoading ? '...' : 'Shuffle'}
                </button>
              </div>
            </div>

            {/* Inline player */}
            {activeVideoId && (
              <div className="mb-3 rounded-xl overflow-hidden bg-black relative group">
                <div className="aspect-video">
                  <iframe
                    key={activeVideoId}
                    src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                    title="Embedded player"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
                <button onClick={() => setActiveVideoId(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="space-y-2">
              {contentLoading && randomContent.length === 0 && (
                <div className="py-6 text-center"><span className="w-4 h-4 border-2 border-agent-mindcare/30 border-t-agent-mindcare rounded-full animate-spin inline-block" /></div>
              )}
              {randomContent.map((c: any, i: number) => {
                const isActive = activeVideoId === c.videoId;
                return (
                  <button key={`${c.videoId}-${i}`} onClick={() => setActiveVideoId(c.videoId)}
                    className={`w-full flex items-center gap-3 p-1.5 rounded-xl transition-colors group text-left ${isActive ? 'bg-agent-mindcare/10' : 'hover:bg-black/[0.03]'}`}>
                    <div className="w-24 h-14 rounded-lg overflow-hidden bg-bg-card shrink-0 relative">
                      {c.thumbnail && (
                        <img src={c.thumbnail} alt={c.title} loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <Play size={16} className="text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'text-agent-mindcare' : 'text-text-primary'}`}>{c.title}</p>
                      <p className="text-xs text-text-muted">{c.type}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* AI Mind Care Chat */}
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="card rounded-2xl p-5 flex flex-col h-[640px] max-h-[80vh]">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border-subtle shrink-0">
            <div className="w-7 h-7 rounded-full bg-agent-mindcare/10 border border-agent-mindcare/20 flex items-center justify-center">
              <Brain size={14} className="text-agent-mindcare" />
            </div>
            <span className="text-sm font-medium text-text-primary">AI Mind Care</span>
            <span className="text-xs text-text-muted ml-auto">Mental Wellness</span>
          </div>
          <div className="flex-1 min-h-0">
            <AgentChat agentType="mindcare" />
          </div>
        </motion.div>
      </div>
    </div>
    </>
  );
}
