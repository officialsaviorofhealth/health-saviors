import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — Health Saviors',
  description: 'How Health Saviors collects, uses, and protects your health data.',
};

const SECTIONS: { h: string; body: React.ReactNode }[] = [
  {
    h: '1. Who we are',
    body: (
      <p>
        Health Saviors (the "Service") is an AI-assisted health-tracking application. It is operated by the Health Saviors team
        ("we", "us"). Contact: <a href="mailto:admin@health-saviors.app" className="text-accent underline">admin@health-saviors.app</a>.
      </p>
    ),
  },
  {
    h: '2. What we collect',
    body: (
      <ul className="list-disc ml-5 space-y-1">
        <li><strong>Account &amp; identity:</strong> wallet address, optional display name, optional age / height / weight, chronic conditions you select.</li>
        <li><strong>Daily logs you create:</strong> water, meals (descriptions + AI-estimated nutrition), exercise, sleep, mood, meditation sessions, community posts.</li>
        <li><strong>Conversations:</strong> messages exchanged with the AI agents (stored to provide cross-session memory).</li>
        <li><strong>Push subscriptions:</strong> the browser push endpoint and keys, only when you opt in.</li>
        <li><strong>Operational data:</strong> request timestamps, IP at sign-in (audit log), basic user-agent.</li>
      </ul>
    ),
  },
  {
    h: '3. How we use it',
    body: (
      <ul className="list-disc ml-5 space-y-1">
        <li>Provide the AI agents (Nurse, Gatekeeper, Nutritionist, MindCare) with the context needed to give personalized guidance.</li>
        <li>Calculate streaks, daily progress, and reward eligibility.</li>
        <li>Send the notifications you have enabled in <Link href="/notifications" className="text-accent underline">Notifications</Link>.</li>
        <li>Diagnose abuse, billing, and security issues.</li>
      </ul>
    ),
  },
  {
    h: '4. Third-party services',
    body: (
      <ul className="list-disc ml-5 space-y-1">
        <li><strong>xAI (Grok):</strong> message text + minimal user context (age, BMI, chronic conditions, recent topics) is sent to xAI to generate responses and to extract meals from chat. xAI's data handling: <a href="https://x.ai/legal/privacy-policy" className="text-accent underline" target="_blank" rel="noreferrer">x.ai/legal/privacy-policy</a>.</li>
        <li><strong>Neon (PostgreSQL):</strong> primary database. <a href="https://neon.tech/privacy-policy" className="text-accent underline" target="_blank" rel="noreferrer">neon.tech/privacy-policy</a>.</li>
        <li><strong>Vercel:</strong> hosting + edge delivery. <a href="https://vercel.com/legal/privacy-policy" className="text-accent underline" target="_blank" rel="noreferrer">vercel.com/legal/privacy-policy</a>.</li>
        <li><strong>Browser push services</strong> (FCM / APNs / Mozilla) deliver the actual push payloads to your device.</li>
      </ul>
    ),
  },
  {
    h: '5. Storage &amp; security',
    body: (
      <ul className="list-disc ml-5 space-y-1">
        <li>Data is stored on Neon PostgreSQL with TLS in transit and at rest.</li>
        <li>JWTs are signed; sensitive secrets server-side are encrypted (AES-256-GCM) with a key not stored in the database.</li>
        <li>We do <strong>not</strong> sell your data. We do not run third-party advertising trackers.</li>
      </ul>
    ),
  },
  {
    h: '6. Your rights',
    body: (
      <ul className="list-disc ml-5 space-y-1">
        <li><strong>Access / export:</strong> contact us and we will return all data tied to your account.</li>
        <li><strong>Deletion:</strong> contact us to delete your account and all associated logs. Push subscriptions and notification preferences are removable from <Link href="/notifications" className="text-accent underline">/notifications</Link>.</li>
        <li><strong>Correction:</strong> edit logs (e.g. meals) inline in each tracker, or contact us.</li>
        <li><strong>Withdraw consent:</strong> withdrawing consent stops new processing but does not affect lawful processing already done.</li>
      </ul>
    ),
  },
  {
    h: '7. Retention',
    body: (
      <p>We retain logs and conversations for as long as your account is active. On account deletion we remove personal data within 30 days (longer only when legally required, e.g. anti-fraud audit logs).</p>
    ),
  },
  {
    h: '8. Children',
    body: <p>Health Saviors is not directed at users under 16. Do not create an account if you are under 16.</p>,
  },
  {
    h: '9. Changes',
    body: <p>If we materially change this policy we will surface a notice in-app before continuing to process data under the new terms.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-16">
      <h1 className="font-display text-3xl sm:text-4xl text-text-primary">Privacy Policy</h1>
      <p className="text-sm text-text-muted mt-2">Last updated: 2026-05-15</p>

      <div className="mt-8 space-y-6 text-sm text-text-secondary leading-relaxed">
        {SECTIONS.map(s => (
          <section key={s.h}>
            <h2 className="text-base font-semibold text-text-primary mb-2">{s.h}</h2>
            {s.body}
          </section>
        ))}

        <div className="pt-4 mt-8 border-t border-border-subtle text-xs text-text-muted">
          See also: <Link href="/terms" className="text-accent underline">Terms of Service</Link>.
        </div>
      </div>
    </div>
  );
}
