'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, ArrowLeft, Check, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CHRONIC_CONDITIONS } from '@/lib/types';

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.12 } } };

export default function ProfileSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [dataConsent, setDataConsent] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) { router.push('/'); return; }
    try {
      const user = JSON.parse(storedUser);
      if (user.displayName) setDisplayName(user.displayName);
      if (user.profileComplete && user.displayName) router.push('/');
    } catch { router.push('/'); }
  }, [router]);

  const toggleCondition = (code: string) => {
    setConditions(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const validateStep1 = () => {
    const name = displayName.trim();
    if (!name || name.length < 2) return 'Please enter a name (2+ characters)';
    if (name.length > 30) return 'Name must be 30 characters or less';
    if (!age || Number(age) < 1 || Number(age) > 150) return 'Please enter a valid age';
    if (!heightCm || Number(heightCm) < 50 || Number(heightCm) > 300) return 'Please enter a valid height';
    if (!weightKg || Number(weightKg) < 10 || Number(weightKg) > 500) return 'Please enter a valid weight';
    return null;
  };

  const nextStep = () => {
    setError('');
    const err = validateStep1();
    if (err) { setError(err); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: displayName.trim(), age: Number(age), heightCm: Number(heightCm), weightKg: Number(weightKg), chronicConditions: conditions, dataConsent }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          // Stale or invalid token — clear it so the user can log in fresh
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setError('Session expired. Redirecting to login...');
          setTimeout(() => router.push('/login'), 1200);
          setLoading(false);
          return;
        }
        setError(data.error || 'Profile update failed'); setLoading(false); return;
      }
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/');
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const inputClass = "w-full bg-bg-card border border-border rounded-2xl px-6 py-5 text-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/40 transition-all";

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 sm:px-6 py-12">
      <motion.div variants={stagger} initial="hidden" animate="visible" className="w-full max-w-2xl space-y-10">

        {/* Header */}
        <motion.div variants={fadeIn} className="text-center space-y-5">
          <div className="w-24 h-24 rounded-full border border-accent/20 bg-accent/5 flex items-center justify-center mx-auto">
            <Heart size={34} className="text-accent fill-accent/20" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-light text-text-primary tracking-[-0.02em]">Health Profile</h1>
          <p className="text-lg text-text-secondary">
            {step === 1 ? 'Tell us about yourself' : 'Any current health conditions?'}
          </p>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all duration-500
                ${s === step ? 'w-16 bg-accent' : s < step ? 'w-10 bg-accent/40' : 'w-10 bg-border'}`} />
            ))}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div variants={fadeIn} className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-base text-center">
            {error}
          </motion.div>
        )}

        {/* Step 1 */}
        {step === 1 && (
          <motion.div variants={fadeIn} className="space-y-6">
            <p className="text-sm text-text-muted text-center">Your name is shown in the app. Health stats stay private.</p>
            <div>
              <label className="text-base font-medium text-text-secondary mb-3 block">Name or nickname</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="How should we call you?" maxLength={30}
                className={inputClass} />
            </div>
            <div>
              <label className="text-base font-medium text-text-secondary mb-3 block">Age</label>
              <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="Your age" min="1" max="150"
                className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="text-base font-medium text-text-secondary mb-3 block">Height (cm)</label>
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170" min="50" max="300"
                  className={inputClass} />
              </div>
              <div>
                <label className="text-base font-medium text-text-secondary mb-3 block">Weight (kg)</label>
                <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70" min="10" max="500"
                  className={inputClass} />
              </div>
            </div>
            <button onClick={nextStep}
              className="w-full flex items-center justify-center gap-3 text-lg font-medium
                bg-text-primary text-bg py-5 rounded-full hover:bg-accent transition-all duration-300">
              Continue <ArrowRight size={18} />
            </button>
            <button onClick={() => router.push('/')}
              className="w-full text-sm text-text-muted hover:text-text-secondary transition-colors">
              Skip for now
            </button>
          </motion.div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <motion.div variants={fadeIn} className="space-y-6">
            <p className="text-sm text-text-muted text-center">Select any current conditions for safer AI guidance.</p>
            <div className="grid grid-cols-2 gap-4">
              {CHRONIC_CONDITIONS.map(c => (
                <button key={c.code} onClick={() => toggleCondition(c.code)}
                  className={`flex items-center gap-3 p-5 rounded-2xl text-left text-base transition-all duration-300
                    ${conditions.includes(c.code)
                      ? 'bg-accent/10 border-2 border-accent/30 text-accent'
                      : 'bg-bg-card border border-border text-text-secondary hover:border-border-hover'
                    }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors
                    ${conditions.includes(c.code) ? 'bg-accent' : 'border-2 border-border'}`}>
                    {conditions.includes(c.code) && <Check size={12} className="text-bg" />}
                  </div>
                  <div className="min-w-0">
                    <span className="block text-base font-medium">{c.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Consent */}
            <div className="card rounded-2xl p-5">
              <button onClick={() => setDataConsent(!dataConsent)} className="flex items-start gap-3 text-left w-full">
                <div className={`w-6 h-6 rounded mt-0.5 flex items-center justify-center shrink-0 transition-colors
                  ${dataConsent ? 'bg-accent' : 'border-2 border-border'}`}>
                  {dataConsent && <Check size={14} className="text-white" />}
                </div>
                <div>
                  <p className="text-base text-text-primary font-medium flex items-center gap-2">
                    <Shield size={15} className="text-accent" /> Health Data Consent
                  </p>
                  <p className="text-sm text-text-secondary mt-1.5 leading-relaxed">
                    I agree to allow Health Saviors to process my health data for AI guidance.
                    Data is encrypted (AES-256), stored in HL7 FHIR format, and never shared without consent.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex items-center justify-center gap-2 text-lg font-medium
                  border border-border text-text-secondary px-8 py-5 rounded-full hover:border-border-hover transition-all">
                <ArrowLeft size={18} /> Back
              </button>
              <button onClick={handleSubmit} disabled={loading || !dataConsent}
                className="flex-1 flex items-center justify-center gap-2 text-lg font-medium
                  bg-text-primary text-bg py-5 rounded-full hover:bg-accent transition-all duration-300
                  disabled:opacity-30 disabled:cursor-not-allowed">
                {loading ? 'Saving...' : 'Complete'} {!loading && <ArrowRight size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-titanium-darker text-center tracking-wider">
              20,000 H2E tokens awarded upon completion
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
