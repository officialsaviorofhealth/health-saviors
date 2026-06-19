import { NextRequest, NextResponse } from 'next/server';

// Each entry: title, videoId (for thumbnail + direct link), type
const VIDEO_POOL = [
  { title: 'Morning Meditation — 10 Min', videoId: 'inpok4MKVLM', type: 'Video' },
  { title: 'Rain Sounds for Deep Sleep', videoId: 'mPZkdNFkNps', type: 'Music' },
  { title: 'Stress Relief Guided Session', videoId: 'z6X5oEIg6Ak', type: 'Video' },
  { title: 'Ocean Waves — 8 Hours', videoId: 'bn9F19Hi1Lk', type: 'Music' },
  { title: 'Deep Sleep Music', videoId: '1ZYbU82GVz4', type: 'Music' },
  { title: '5 Min Breathing Exercise', videoId: 'tEmt1Znux58', type: 'Video' },
  { title: 'Anxiety Relief Meditation', videoId: 'O-6f5wQXSu8', type: 'Video' },
  { title: 'Forest & Bird Sounds', videoId: 'xNN7iTA57jM', type: 'Music' },
  { title: 'Mindfulness for Beginners', videoId: '6p_yaNFSYao', type: 'Video' },
  { title: 'Piano Relaxation — 3 Hours', videoId: '77ZozI0rw7w', type: 'Music' },
  { title: 'Progressive Muscle Relaxation', videoId: '1nZEdqcGVzo', type: 'Video' },
  { title: 'Campfire Sounds', videoId: 'gVKEM4K8J8A', type: 'Music' },
  { title: 'Lofi Study & Focus', videoId: 'jfKfPfyJRdk', type: 'Music' },
  { title: 'Evening Unwind Meditation', videoId: 'aEqlQvczMJQ', type: 'Video' },
  { title: 'White Noise — 10 Hours', videoId: 'nMfPqeZjc2c', type: 'Music' },
  { title: 'Box Breathing — 4-4-4-4', videoId: 'n6RbW2LtdFs', type: 'Video' },
];

// Cache availability checks so we don't hit YouTube on every request.
// videoId -> { ok: boolean; checkedAt: number }
const availabilityCache = new Map<string, { ok: boolean; checkedAt: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// A video is "available" if YouTube's oEmbed endpoint returns 200.
// Deleted / private / region-blocked videos return 401/404 — those would
// otherwise show a broken/gray thumbnail, so we filter them out.
async function isAvailable(videoId: string): Promise<boolean> {
  const cached = availabilityCache.get(videoId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) return cached.ok;

  let ok = false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } },
    );
    clearTimeout(t);
    ok = res.ok; // 200 = embeddable & available
  } catch {
    // Network/timeout — treat as available rather than hide a possibly-fine video.
    ok = true;
  }
  availabilityCache.set(videoId, { ok, checkedAt: Date.now() });
  return ok;
}

function toResult(v: { title: string; type: string; videoId: string }) {
  return {
    title: v.title,
    type: v.type,
    videoId: v.videoId,
    url: `https://www.youtube.com/watch?v=${v.videoId}`,
    // hqdefault always exists for live videos; the client also has an onError fallback.
    thumbnail: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
  };
}

// GET /api/youtube?count=6 — returns random AVAILABLE videos with thumbnails
export async function GET(request: NextRequest) {
  const count = Math.max(1, Math.min(parseInt(request.nextUrl.searchParams.get('count') || '6') || 6, VIDEO_POOL.length));

  const shuffled = [...VIDEO_POOL].sort(() => Math.random() - 0.5);

  const available: typeof VIDEO_POOL = [];
  // Validate in small concurrent batches until we have enough live videos.
  for (let i = 0; i < shuffled.length && available.length < count; i += 6) {
    const batch = shuffled.slice(i, i + 6);
    const checks = await Promise.all(batch.map(v => isAvailable(v.videoId)));
    batch.forEach((v, idx) => { if (checks[idx]) available.push(v); });
  }

  // Fallback: if availability checks somehow filtered everything (e.g. YouTube
  // blocked the server), return the random pick so the UI is never empty.
  const picked = available.length > 0 ? available.slice(0, count) : shuffled.slice(0, count);

  return NextResponse.json(
    { results: picked.map(toResult) },
    { headers: { 'Cache-Control': 'public, max-age=900' } },
  );
}
