import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { awardPoints, STREAK_REWARDS } from '@/lib/points';

// Total payload cap for image uploads (~6 MB of base64 ≈ 4.5 MB of decoded image bytes).
const MAX_TOTAL_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES = 10;

function sanitizeImages(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const valid = input
    .filter((s): s is string => typeof s === 'string' && s.startsWith('data:image/'))
    .slice(0, MAX_IMAGES);
  let total = 0;
  const out: string[] = [];
  for (const s of valid) {
    total += s.length;
    if (total > MAX_TOTAL_IMAGE_BYTES) break;
    out.push(s);
  }
  return out;
}

function asImagesArray(value: any): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try { const v = JSON.parse(value); return Array.isArray(v) ? v : []; } catch { return []; }
  }
  return [];
}

// GET /api/community?category=general&page=1
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get('category');
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
  const limit = 20;

  const where = category ? { category } : {};

  const [posts, total] = await Promise.all([
    prisma.communityPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { walletAddress: true, displayName: true } },
        _count: { select: { comments: true, likes: true } },
      },
    }),
    prisma.communityPost.count({ where }),
  ]);

  const result = posts.map(p => {
    const images = asImagesArray(p.images);
    const legacy = p.imageUrl ? [p.imageUrl] : [];
    const allImages = images.length > 0 ? images : legacy;
    // Never expose wallet addresses — fall back to a friendly anonymous label.
    const friendlyFallback = `Member ${p.userId.slice(0, 4)}`;
    return {
      id: p.id,
      category: p.category,
      title: p.title,
      content: p.content,
      images: allImages,
      author: p.user.displayName?.trim() || friendlyFallback,
      authorHasName: !!p.user.displayName?.trim(),
      comments: p._count.comments,
      likes: p._count.likes,
      createdAt: p.createdAt,
    };
  });

  return NextResponse.json({ posts: result, total, page, totalPages: Math.ceil(total / limit) });
}

// POST /api/community
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { category, title, content, imageUrl, images } = body;

  const cleanImages = sanitizeImages(images);
  const trimmedContent = (content || '').toString().trim();

  if (!trimmedContent && cleanImages.length === 0) {
    return NextResponse.json({ error: 'Add a caption or at least one photo' }, { status: 400 });
  }

  // Auto-derive title from first line of content if not provided (Instagram-style)
  const derivedTitle = (title && typeof title === 'string' && title.trim())
    ? title.trim().slice(0, 200)
    : trimmedContent
      ? trimmedContent.split('\n')[0].slice(0, 80)
      : null;

  const post = await prisma.communityPost.create({
    data: {
      userId: user.userId,
      category: category || 'general',
      title: derivedTitle,
      content: trimmedContent,
      imageUrl: imageUrl || null,
      images: cleanImages.length > 0 ? cleanImages : undefined,
    },
  });

  await awardPoints(user.userId, STREAK_REWARDS.COMMUNITY_POST, 'DAILY_LOG', 'Community post');

  return NextResponse.json({ post });
}
