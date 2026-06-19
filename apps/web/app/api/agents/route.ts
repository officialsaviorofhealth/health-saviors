import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// GET /api/agents — list my agents
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await prisma.userAgent.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'asc' },
  });

  // Get conversation counts and last conversation summary per agent type
  const agentTypes = agents.map(a => a.agentType);

  const conversationCounts = await prisma.conversation.groupBy({
    by: ['agentType'],
    where: {
      userId: payload.userId,
      agentType: { in: agentTypes },
    },
    _count: { id: true },
  });

  const countMap = new Map(
    conversationCounts.map(c => [c.agentType, c._count.id])
  );

  // Get the last conversation with its most recent message for each agent type
  const lastConversations = await prisma.conversation.findMany({
    where: {
      userId: payload.userId,
      agentType: { in: agentTypes },
    },
    orderBy: { updatedAt: 'desc' },
    distinct: ['agentType'],
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true },
      },
    },
  });

  const lastSummaryMap = new Map(
    lastConversations.map(c => [
      c.agentType,
      c.messages[0]?.content || null,
    ])
  );

  const result = agents.map(agent => ({
    id: agent.id,
    agentType: agent.agentType,
    nickname: agent.nickname,
    personality: agent.personality,
    telegramEnabled: agent.telegramEnabled,
    telegramChatId: agent.telegramChatId,
    isActive: agent.isActive,
    lastInteraction: agent.lastInteraction,
    totalMessages: agent.totalMessages,
    createdAt: agent.createdAt,
    conversationCount: countMap.get(agent.agentType) || 0,
    lastConversationSummary: lastSummaryMap.get(agent.agentType) || null,
  }));

  return NextResponse.json({ agents: result });
}
