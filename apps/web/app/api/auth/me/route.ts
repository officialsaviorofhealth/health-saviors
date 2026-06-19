import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      chronicConditions: true,
      userAgents: { orderBy: { createdAt: 'asc' } },
      _count: { select: { conversations: true, healthRecords: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      walletAddress: user.walletAddress,
      profileComplete: user.profileComplete,
      age: user.age,
      heightCm: user.heightCm,
      weightKg: user.weightKg,
      tokenBalance: user.tokenBalance,
      dataConsent: user.dataConsent,
      chronicConditions: user.chronicConditions.map(c => c.conditionCode),
      userAgents: user.userAgents.map(a => ({
        id: a.id,
        agentType: a.agentType,
        nickname: a.nickname,
        personality: a.personality,
        telegramEnabled: a.telegramEnabled,
        telegramChatId: a.telegramChatId,
        isActive: a.isActive,
        lastInteraction: a.lastInteraction,
        totalMessages: a.totalMessages,
        createdAt: a.createdAt,
      })),
      stats: {
        totalConversations: user._count.conversations,
        totalHealthRecords: user._count.healthRecords,
      },
      createdAt: user.createdAt,
    },
  });
}
