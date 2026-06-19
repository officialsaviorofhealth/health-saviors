'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Send, Hash, Bot, Webhook, Code, ArrowRight, ExternalLink, Clock, Bell } from 'lucide-react';
import { fadeInUp, staggerContainer } from '@/lib/animations';

const platforms = [
  {
    name: 'Telegram',
    icon: Send,
    color: '#0088cc',
    status: 'Available',
    statusColor: '#00e87b',
    description: 'Connect your AI health agents to Telegram. Receive proactive health check-in reminders and chat with agents anytime.',
    features: ['Daily health check-in reminders', 'Symptom triage on the go', 'Push notifications for health alerts', 'Multi-language support'],
    steps: [
      'Create a Telegram bot via @BotFather',
      'Get your bot token',
      'Go to Settings \u2192 Integrations \u2192 Telegram',
      'Paste your bot token and connect',
      'Set your preferred check-in times',
    ],
    webhook: 'POST /api/integrations/telegram/webhook',
  },
  {
    name: 'Slack',
    icon: Hash,
    color: '#4A154B',
    status: 'Coming Soon',
    statusColor: '#f0a030',
    description: 'Integrate AI health agents into your Slack workspace. Perfect for team wellness programs and corporate health initiatives.',
    features: ['Workspace health channels', 'Team wellness challenges', 'Private DM health coaching', 'Scheduled wellness breaks'],
    steps: [
      'Create a Slack app at api.slack.com',
      'Configure OAuth scopes (chat:write, commands)',
      'Install to your workspace',
      'Connect via Settings \u2192 Integrations \u2192 Slack',
      'Choose which channels to enable',
    ],
    webhook: 'POST /api/integrations/slack/events',
  },
  {
    name: 'Discord',
    icon: MessageCircle,
    color: '#5865F2',
    status: 'Coming Soon',
    statusColor: '#f0a030',
    description: 'Add AI health agents to your Discord server. Great for health-focused communities and support groups.',
    features: ['Server health bot', 'Community health challenges', 'Private health coaching DMs', 'Health tips channel'],
    steps: [
      'Create a Discord application at discord.dev',
      'Add bot to your server',
      'Configure permissions',
      'Connect via Settings \u2192 Integrations \u2192 Discord',
      'Select target channels',
    ],
    webhook: 'POST /api/integrations/discord/interactions',
  },
];

const proactiveFeatures = [
  { icon: Clock, title: 'Scheduled Check-ins', desc: 'AI Nurse sends daily health check-in messages at your preferred time.' },
  { icon: Bell, title: 'Smart Alerts', desc: 'Get notified when your health patterns show concerning trends.' },
  { icon: Bot, title: 'Autonomous Follow-ups', desc: 'Agents proactively follow up on symptoms you reported earlier.' },
  { icon: Webhook, title: 'Webhook Events', desc: 'Receive real-time health events via webhooks for custom integrations.' },
];

export default function GuidePage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mb-12 space-y-4">
        <motion.p variants={fadeInUp} className="text-[12px] font-mono font-semibold tracking-[0.12em] uppercase text-[#00e87b]">
          Integration Guide
        </motion.p>
        <motion.h1 variants={fadeInUp} className="text-2xl sm:text-4xl font-bold text-[#e8ecf4]">
          Connect Your AI Agents to <span className="text-gradient">Messengers</span>
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-[#8494a7] max-w-2xl text-sm leading-relaxed">
          Your AI health agents can act as personal health assistants on your favorite messaging platforms.
          Receive proactive check-ins, get instant triage, and track your health — all from your messenger app.
        </motion.p>
      </motion.div>

      {/* Proactive AI Section */}
      <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="mb-16">
        <motion.h2 variants={fadeInUp} className="text-lg font-semibold text-[#e8ecf4] mb-6 flex items-center gap-2">
          <Bot size={20} className="text-[#00e87b]" /> Proactive AI Agent Features
        </motion.h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {proactiveFeatures.map(f => (
            <motion.div key={f.title} variants={fadeInUp}
              className="rounded-[16px] border border-black/[0.07] bg-[#0d1525]/60 backdrop-blur-xl p-5">
              <f.icon size={20} className="text-[#00e87b] mb-3" />
              <h3 className="text-sm font-semibold text-[#e8ecf4] mb-1">{f.title}</h3>
              <p className="text-xs text-[#8494a7] leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Platforms */}
      <motion.div variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }} className="space-y-6">
        <motion.h2 variants={fadeInUp} className="text-lg font-semibold text-[#e8ecf4] flex items-center gap-2">
          <MessageCircle size={20} className="text-[#3b82f6]" /> Supported Platforms
        </motion.h2>

        {platforms.map(platform => (
          <motion.div key={platform.name} variants={fadeInUp}
            className="rounded-[20px] border border-black/[0.07] bg-[#0d1525]/60 backdrop-blur-xl overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${platform.color}20`, border: `1px solid ${platform.color}40` }}>
                    <platform.icon size={24} style={{ color: platform.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#e8ecf4]">{platform.name}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${platform.statusColor}15`, color: platform.statusColor, border: `1px solid ${platform.statusColor}30` }}>
                      {platform.status}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-[#8494a7] mb-6 leading-relaxed">{platform.description}</p>

              <div className="grid sm:grid-cols-2 gap-6">
                {/* Features */}
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-[#8494a7] tracking-wider mb-3">FEATURES</h4>
                  <ul className="space-y-2">
                    {platform.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-[#8494a7]">
                        <div className="w-1 h-1 rounded-full bg-[#00e87b]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Setup Steps */}
                <div>
                  <h4 className="text-[11px] font-mono font-semibold text-[#8494a7] tracking-wider mb-3">SETUP STEPS</h4>
                  <ol className="space-y-2">
                    {platform.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[#8494a7]">
                        <span className="text-[10px] font-mono text-[#00e87b] mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Webhook endpoint */}
              <div className="mt-6 p-3 rounded-xl bg-[#111b2e] border border-black/[0.06]">
                <div className="flex items-center gap-2 mb-1">
                  <Code size={12} className="text-[#f0a030]" />
                  <span className="text-[10px] font-mono text-[#8494a7] tracking-wider">WEBHOOK ENDPOINT</span>
                </div>
                <code className="text-xs font-mono text-[#00e87b]">{platform.webhook}</code>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* API Section */}
      <motion.div variants={fadeInUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="mt-12 rounded-[20px] border border-black/[0.07] bg-[#0d1525]/60 backdrop-blur-xl p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[#e8ecf4] mb-4 flex items-center gap-2">
          <Code size={20} className="text-[#f0a030]" /> Developer API
        </h2>
        <p className="text-sm text-[#8494a7] mb-6">
          Build custom integrations with our REST API. Send messages to any agent and receive structured health responses.
        </p>
        <div className="bg-[#111b2e] rounded-xl p-4 overflow-x-auto">
          <pre className="text-xs font-mono text-[#8494a7]">
{`// Example: Chat with AI Nurse
POST /api/chat
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "message": "I've been having trouble sleeping",
  "agentType": "nurse",
  "conversationId": "optional-conversation-id"
}

// Response
{
  "response": "Let me help with your sleep...",
  "conversationId": "conv_abc123",
  "metadata": {
    "tags": ["sleep", "insomnia"]
  }
}`}
          </pre>
        </div>
      </motion.div>
    </div>
  );
}
