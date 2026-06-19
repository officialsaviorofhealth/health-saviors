import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const VALID_AGENT_TYPES = ['nurse', 'gatekeeper', 'nutritionist', 'mindcare'];

// GET /api/agents/:agentType — get single agent details with recent conversations
export async function GET(
  request: NextRequest,
  { params }: { params: { agentType: string } }
) {
  const payload = getUserFromRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agentType } = params;
  if (!VALID_AGENT_TYPES.includes(agentType)) {
    return NextResponse.json({ error: 'Invalid agent type' }, { status: 400 });
  }

  const agent = await prisma.userAgent.findUnique({
    where: {
      userId_agentType: {
        userId: payload.userId,
        agentType,
      },
    },
  });

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Fetch last 5 conversations with message previews
  const recentConversations = await prisma.conversation.findMany({
    where: {
      userId: payload.userId,
      agentType,
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      },
      _count: { select: { messages: true } },
    },
  });

  // Total conversation count
  const conversationCount = await prisma.conversation.count({
    where: {
      userId: payload.userId,
      agentType,
    },
  });

  return NextResponse.json({
    agent: {
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
      conversationCount,
    },
    recentConversations: recentConversations.map(c => ({
      id: c.id,
      summary: c.summary,
      messageCount: c._count.messages,
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
      messagePreview: c.messages.reverse().map(m => ({
        id: m.id,
        role: m.role,
        content: m.content.length > 200 ? m.content.substring(0, 200) + '...' : m.content,
        createdAt: m.createdAt,
      })),
    })),
  });
}

// PATCH /api/agents/:agentType — update agent nickname or personality
export async function PATCH(
  request: NextRequest,
  { params }: { params: { agentType: string } }
) {
  const payload = getUserFromRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { agentType } = params;
  if (!VALID_AGENT_TYPES.includes(agentType)) {
    return NextResponse.json({ error: 'Invalid agent type' }, { status: 400 });
  }

  const body = await request.json();
  const { nickname, personality } = body;

  // Validate inputs
  if (nickname !== undefined && (typeof nickname !== 'string' || nickname.length === 0 || nickname.length > 50)) {
    return NextResponse.json({ error: 'Nickname must be 1-50 characters' }, { status: 400 });
  }
  if (personality !== undefined && typeof personality !== 'string') {
    return NextResponse.json({ error: 'Personality must be a string' }, { status: 400 });
  }

  // Build update data
  const updateData: { nickname?: string; personality?: string } = {};
  if (nickname !== undefined) updateData.nickname = nickname;
  if (personality !== undefined) updateData.personality = personality;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const agent = await prisma.userAgent.update({
      where: {
        userId_agentType: {
          userId: payload.userId,
          agentType,
        },
      },
      data: updateData,
    });

    return NextResponse.json({
      agent: {
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
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
}
