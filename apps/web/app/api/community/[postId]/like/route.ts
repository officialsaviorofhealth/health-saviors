import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push';

// POST /api/community/[postId]/like — toggle like
export async function POST(request: NextRequest, { params }: { params: { postId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.communityLike.findUnique({
    where: { postId_userId: { postId: params.postId, userId: user.userId } },
  });

  if (existing) {
    await prisma.communityLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }

  await prisma.communityLike.create({
    data: { postId: params.postId, userId: user.userId },
  });

  // Notify the post owner — but never push to yourself for liking your own post.
  // Tag is per-post so a flurry of likes only shows up as a single notification.
  const post = await prisma.communityPost.findUnique({
    where: { id: params.postId },
    select: {
      userId: true,
      content: true,
      title: true,
      _count: { select: { likes: true } },
    },
  });
  if (post && post.userId !== user.userId) {
    const liker = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { displayName: true },
    });
    const likerName = liker?.displayName?.trim() || 'Someone';
    const preview = (post.title || post.content || '').slice(0, 60);
    sendPushToUser(post.userId, {
      title: `❤️ ${likerName} liked your post`,
      body: preview
        ? `"${preview}${preview.length === 60 ? '…' : ''}" · ${post._count.likes} likes`
        : `${post._count.likes} likes total`,
      url: '/community',
      tag: `like-${params.postId}`,
      renotify: false,
    }, 'community').catch(() => {});
  }

  return NextResponse.json({ liked: true });
}
