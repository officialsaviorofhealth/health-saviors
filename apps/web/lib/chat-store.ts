import { Message, Conversation, AgentType } from './types';

const STORAGE_KEY = 'health-saviors-conversations';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function getConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function getConversation(id: string): Conversation | undefined {
  return getConversations().find(c => c.id === id);
}

export function getActiveConversation(agentType: AgentType): Conversation | undefined {
  const convs = getConversations();
  const today = new Date().toDateString();
  return convs.find(c => c.agentType === agentType && new Date(c.updatedAt).toDateString() === today);
}

export function createConversation(agentType: AgentType): Conversation {
  const conv: Conversation = {
    id: generateId(),
    agentType,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const convs = getConversations();
  convs.unshift(conv);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  return conv;
}

export function addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Message {
  const convs = getConversations();
  const conv = convs.find(c => c.id === conversationId);
  if (!conv) throw new Error('Conversation not found');

  const msg: Message = {
    ...message,
    id: generateId(),
    timestamp: new Date(),
  };
  conv.messages.push(msg);
  conv.updatedAt = new Date();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  return msg;
}

export function deleteConversation(id: string): void {
  const convs = getConversations().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

export function getHealthStats() {
  const convs = getConversations();
  const totalMessages = convs.reduce((sum, c) => sum + c.messages.length, 0);
  const nurseConvs = convs.filter(c => c.agentType === 'nurse').length;
  const gatekeeperConvs = convs.filter(c => c.agentType === 'gatekeeper').length;

  const today = new Date().toDateString();
  const todayConvs = convs.filter(c => new Date(c.updatedAt).toDateString() === today);

  // Calculate streak
  let streak = 0;
  const dates = [...new Set(convs.map(c => new Date(c.createdAt).toDateString()))].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  for (let i = 0; i < dates.length; i++) {
    const expected = new Date();
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toDateString()) {
      streak++;
    } else break;
  }

  return {
    totalConversations: convs.length,
    totalMessages,
    nurseConvs,
    gatekeeperConvs,
    todayCheckIn: todayConvs.length > 0,
    streak,
  };
}
