import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: { postId: string } }) {
  const comments = await prisma.communityComment.findMany({
    where: { postId: params.postId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { walletAddress: true, displayName: true } } },
  });

  return NextResponse.json({
    comments: comments.map(c => {
      const friendlyFallback = `Member ${c.userId.slice(0, 4)}`;
      return {
        id: c.id,
        content: c.content,
        author: c.user.displayName?.trim() || friendlyFallback,
        createdAt: c.createdAt,
      };
    }),
  });
}

export async function POST(request: NextRequest, { params }: { params: { postId: string } }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.content) return NextResponse.json({ error: 'content required' }, { status: 400 });

  const comment = await prisma.communityComment.create({
    data: { postId: params.postId, userId: user.userId, content: body.content },
  });

  // Notify the post owner (but not for self-comments)
  const post = await prisma.communityPost.findUnique({
    where: { id: params.postId },
    select: { userId: true, content: true, title: true },
  });
  if (post && post.userId !== user.userId) {
    const { sendPushToUser } = await import('@/lib/push');
    const commenter = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { displayName: true },
    });
    const name = commenter?.displayName?.trim() || 'Someone';
    const commentPreview = String(body.content).slice(0, 80);
    sendPushToUser(post.userId, {
      title: `💬 ${name} commented on your post`,
      body: commentPreview + (String(body.content).length > 80 ? '…' : ''),
      url: '/community',
      tag: `comment-${params.postId}`,
      renotify: true,
    }, 'community').catch(() => {});
  }

  return NextResponse.json({ comment });
}
