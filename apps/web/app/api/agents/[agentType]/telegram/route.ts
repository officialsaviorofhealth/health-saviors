import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

const VALID_AGENT_TYPES = ['nurse', 'gatekeeper', 'nutritionist', 'mindcare'];

// POST /api/agents/:agentType/telegram — connect telegram chat
export async function POST(
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
  const { chatId } = body;

  if (!chatId || typeof chatId !== 'string' || chatId.length > 50) {
    return NextResponse.json({ error: 'Valid chatId is required' }, { status: 400 });
  }

  try {
    const agent = await prisma.userAgent.update({
      where: {
        userId_agentType: {
          userId: payload.userId,
          agentType,
        },
      },
      data: {
        telegramChatId: chatId,
        telegramEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        agentType: agent.agentType,
        nickname: agent.nickname,
        telegramEnabled: agent.telegramEnabled,
        telegramChatId: agent.telegramChatId,
        isActive: agent.isActive,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
}

// DELETE /api/agents/:agentType/telegram — disconnect telegram
export async function DELETE(
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

  try {
    const agent = await prisma.userAgent.update({
      where: {
        userId_agentType: {
          userId: payload.userId,
          agentType,
        },
      },
      data: {
        telegramChatId: null,
        telegramEnabled: false,
      },
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        agentType: agent.agentType,
        nickname: agent.nickname,
        telegramEnabled: agent.telegramEnabled,
        telegramChatId: agent.telegramChatId,
        isActive: agent.isActive,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
}
