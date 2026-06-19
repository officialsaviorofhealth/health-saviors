'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Heart, Plus, Send, ChevronLeft, ChevronRight,
  ImagePlus, X, MoreHorizontal, Bookmark,
} from 'lucide-react';

const fadeIn = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } };

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'diary', label: 'Diary' },
  { id: 'tips', label: 'Tips' },
];

const MAX_IMAGES = 10;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;
const MAX_DIM = 1600;

interface Post {
  id: string;
  category: string;
  title: string | null;
  content: string;
  images: string[];
  author: string;
  authorHasName: boolean;
  comments: number;
  likes: number;
  createdAt: string;
}

interface Comment {
  id: string;
  content: string;
  author: string;
  createdAt: string;
}

function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 60%, 55%)`;
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

async function fileToResizedBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('image decode failed'));
    i.src = dataUrl;
  });
  const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function PostCarousel({ images }: { images: string[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;

  // Track active slide based on scroll position (snap-aware)
  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const next = Math.round(el.scrollLeft / w);
    if (next !== idx && next >= 0 && next < images.length) setIdx(next);
  }

  function goTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); goTo(Math.max(0, idx - 1)); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); goTo(Math.min(images.length - 1, idx + 1)); };

  return (
    <div className="relative bg-black/[0.04] aspect-square overflow-hidden select-none group">
      {/* Native horizontal scroller with mandatory snap — gives true Instagram-like swipe on mobile + desktop */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scrollbar-none"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          // Prevent vertical scroll from being eaten by horizontal scroller on touch
          touchAction: 'pan-x',
        }}
      >
        {images.map((src, i) => (
          <div key={i} className="snap-center shrink-0 w-full h-full" style={{ scrollSnapAlign: 'center' }}>
            <img
              src={src}
              alt=""
              draggable={false}
              loading={i === 0 ? 'eager' : 'lazy'}
              className="w-full h-full object-cover pointer-events-none"
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          {/* Chevrons — only on hover (desktop), hidden on mobile where you swipe */}
          <button onClick={prev} aria-label="Previous"
            disabled={idx === 0}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-text-primary items-center justify-center shadow opacity-0 group-hover:opacity-100 transition disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} aria-label="Next"
            disabled={idx === images.length - 1}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-text-primary items-center justify-center shadow opacity-0 group-hover:opacity-100 transition disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-medium bg-black/55 text-white tabular-nums pointer-events-none">
            {idx + 1}/{images.length}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span key={i}
                className={`rounded-full transition-all ${i === idx ? 'w-2 h-2 bg-white' : 'w-1.5 h-1.5 bg-white/55'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Skeleton placeholder for the feed while posts are loading.
// Mirrors the real PostCard layout so nothing jumps when content arrives.
function PostSkeleton({ hideImage }: { hideImage?: boolean } = {}) {
  return (
    <article className="card overflow-hidden p-0 animate-pulse">
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-black/[0.06] shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 w-28 rounded bg-black/[0.06]" />
          <div className="h-2.5 w-20 rounded bg-black/[0.04]" />
        </div>
      </div>
      {/* Image area (square, like real posts) */}
      {!hideImage && <div className="aspect-square bg-black/[0.04]" />}
      {/* Action bar */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="w-6 h-6 rounded-full bg-black/[0.06]" />
        <div className="w-6 h-6 rounded-full bg-black/[0.06]" />
        <div className="w-6 h-6 rounded-full bg-black/[0.06]" />
      </div>
      {/* Caption lines */}
      <div className="px-4 pt-3 pb-5 space-y-1.5">
        <div className="h-3 w-1/2 rounded bg-black/[0.06]" />
        <div className="h-2.5 w-3/4 rounded bg-black/[0.04]" />
        <div className="h-2.5 w-2/5 rounded bg-black/[0.04]" />
      </div>
    </article>
  );
}

// Each post manages its own comment state inline
function PostCard({ post, token }: { post: Post; token: string | null }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentCount, setCommentCount] = useState(post.comments);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentInputFocused, setCommentInputFocused] = useState(false);
  const [posting, setPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const visibleComments = showAllComments ? comments : comments.slice(-2);

  async function loadComments() {
    const res = await fetch(`/api/community/${post.id}/comments`);
    const data = await res.json();
    const list: Comment[] = data.comments || [];
    setComments(list);
    setCommentCount(list.length);
  }

  // Lazy-load comments when there are any
  useEffect(() => {
    if (post.comments > 0) loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  async function toggleLike() {
    if (!token) return;
    setLiked(v => !v);
    setLikeCount(c => c + (liked ? -1 : 1));
    try {
      await fetch(`/api/community/${post.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch {
      // revert on failure
      setLiked(v => !v);
      setLikeCount(c => c + (liked ? 1 : -1));
    }
  }

  async function addComment() {
    if (!token || !commentText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/community/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText('');
        await loadComments();
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <motion.article variants={fadeIn} initial="hidden" animate="visible"
      className="card overflow-hidden p-0">
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
          style={{ background: avatarColor(post.author) }}>
          {(post.author[0] || '?').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{post.author}</p>
          <p className="text-[11px] text-text-muted">
            <span className="capitalize">{post.category}</span> · {timeAgo(post.createdAt)}
          </p>
        </div>
        <button className="text-text-muted hover:text-text-primary p-1.5 rounded-full hover:bg-black/[0.04] transition">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Carousel — no click action (no detail modal) */}
      {post.images.length > 0 && <PostCarousel images={post.images} />}

      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 pt-3">
        <button onClick={toggleLike}
          className={`p-2 rounded-full hover:bg-black/[0.05] transition active:scale-95 ${liked ? 'text-accent' : 'text-text-primary'}`}>
          <Heart size={22} className={liked ? 'fill-accent' : ''} />
        </button>
        <button onClick={() => inputRef.current?.focus()}
          className="p-2 rounded-full hover:bg-black/[0.05] transition active:scale-95 text-text-primary">
          <MessageCircle size={22} />
        </button>
        <button className="p-2 rounded-full hover:bg-black/[0.05] transition active:scale-95 text-text-primary">
          <Send size={20} />
        </button>
        <button className="ml-auto p-2 rounded-full hover:bg-black/[0.05] transition active:scale-95 text-text-primary">
          <Bookmark size={20} />
        </button>
      </div>

      {/* Likes */}
      <div className="px-4 pt-1">
        <p className="text-sm font-semibold text-text-primary">{likeCount.toLocaleString()} likes</p>
      </div>

      {/* Caption */}
      <div className="px-4 pt-1 pb-2">
        <p className="text-sm text-text-primary whitespace-pre-wrap">
          <span className="font-semibold mr-2">{post.author}</span>
          {post.content}
        </p>
      </div>

      {/* Inline comments */}
      {commentCount > 2 && !showAllComments && (
        <button onClick={() => setShowAllComments(true)}
          className="px-4 pb-1 text-sm text-text-muted hover:text-text-secondary transition text-left">
          View all {commentCount} comments
        </button>
      )}
      {comments.length > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {visibleComments.map(c => (
            <p key={c.id} className="text-sm text-text-primary">
              <span className="font-semibold mr-2">{c.author}</span>{c.content}
            </p>
          ))}
        </div>
      )}
      {showAllComments && comments.length > 2 && (
        <button onClick={() => setShowAllComments(false)}
          className="px-4 pb-1 text-xs text-text-muted hover:text-text-secondary transition text-left">
          Hide comments
        </button>
      )}

      {/* Timestamp */}
      <div className="px-4 pb-2">
        <p className="text-[11px] text-text-muted uppercase tracking-wide">{timeAgo(post.createdAt)}</p>
      </div>

      {/* Inline comment input */}
      {token ? (
        <div className="border-t border-border-subtle flex items-center gap-2 px-4 py-3">
          <input ref={inputRef} value={commentText} onChange={e => setCommentText(e.target.value)}
            onFocus={() => setCommentInputFocused(true)}
            onBlur={() => setCommentInputFocused(false)}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
            onKeyDown={e => e.key === 'Enter' && addComment()} />
          {(commentInputFocused || commentText) && (
            <button onClick={addComment} disabled={!commentText.trim() || posting}
              className="text-accent font-semibold text-sm disabled:opacity-30">
              {posting ? '...' : 'Post'}
            </button>
          )}
        </div>
      ) : (
        <div className="border-t border-border-subtle px-4 py-3">
          <p className="text-xs text-text-muted">
            <a href="/login" className="text-accent font-semibold hover:underline">Connect</a> to comment
          </p>
        </div>
      )}
    </motion.article>
  );
}

export default function CommunityPage() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<{ displayName?: string } | null>(null);
  const [category, setCategory] = useState('all');
  const [posts, setPosts] = useState<Post[]>([]);
  // Distinguishes "still fetching" from "fetched and empty" so we don't flash
  // the empty-state message before the request returns.
  const [postsLoading, setPostsLoading] = useState(true);
  // Pagination state for infinite scroll
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [showCompose, setShowCompose] = useState(false);
  const [content, setContent] = useState('');
  const [postCategory, setPostCategory] = useState('general');
  const [composeImages, setComposeImages] = useState<string[]>([]);
  const [composeBusy, setComposeBusy] = useState(false);
  const [composeError, setComposeError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasMore = page < totalPages;

  useEffect(() => {
    const t = localStorage.getItem('token');
    setToken(t);
    try {
      const u = localStorage.getItem('user');
      if (u) setMe(JSON.parse(u));
    } catch {}
    loadPosts(category, 1, /* append */ false);
    // eslint-disable-next-line
  }, []);

  // Reset pagination + reload when the category tab changes
  useEffect(() => {
    setPage(1);
    setTotalPages(1);
    loadPosts(category, 1, false);
    // eslint-disable-next-line
  }, [category]);

  // Infinite scroll — observe a sentinel below the feed and pull the next page
  // when it scrolls into view. We rebind the observer when hasMore / loadingMore
  // changes so a single scroll past the bottom doesn't fire repeatedly.
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (!hasMore || loadingMore || postsLoading) return;

    const node = sentinelRef.current;
    const obs = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) {
        loadPosts(category, page + 1, /* append */ true);
      }
    }, { rootMargin: '300px' }); // start loading slightly before reaching the bottom

    obs.observe(node);
    return () => obs.disconnect();
  }, [page, totalPages, loadingMore, postsLoading, category, hasMore]);

  const headers = (t?: string | null) => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = `Bearer ${t}`;
    return h;
  };

  async function loadPosts(cat: string, pageNum: number, append: boolean) {
    if (append) setLoadingMore(true); else setPostsLoading(true);
    try {
      const q = cat === 'all' ? '' : `&category=${cat}`;
      const res = await fetch(`/api/community?page=${pageNum}${q}`);
      const data = await res.json().catch(() => ({}));
      const incoming: Post[] = data.posts || [];
      setTotalPages(data.totalPages || 1);
      setPage(pageNum);
      if (append) {
        // De-dup by id in case a new post landed on page 1 between fetches
        setPosts(prev => {
          const seen = new Set(prev.map(p => p.id));
          return [...prev, ...incoming.filter(p => !seen.has(p.id))];
        });
      } else {
        setPosts(incoming);
      }
    } finally {
      if (append) setLoadingMore(false); else setPostsLoading(false);
    }
  }

  async function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setComposeError('');
    const remaining = MAX_IMAGES - composeImages.length;
    if (remaining <= 0) {
      setComposeError(`You can attach up to ${MAX_IMAGES} photos`);
      return;
    }
    const toProcess = files.slice(0, remaining);
    setComposeBusy(true);
    try {
      const base64s = await Promise.all(toProcess.map(fileToResizedBase64));
      let total = composeImages.reduce((s, x) => s + x.length, 0);
      const accepted: string[] = [];
      for (const b of base64s) {
        if (total + b.length > MAX_TOTAL_BYTES) {
          setComposeError('Some photos were skipped — total upload size limit reached.');
          break;
        }
        total += b.length;
        accepted.push(b);
      }
      setComposeImages(prev => [...prev, ...accepted]);
    } catch (err: any) {
      setComposeError(err?.message || 'Failed to process images');
    } finally {
      setComposeBusy(false);
    }
  }

  function removeImage(idx: number) {
    setComposeImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function publishPost() {
    if (!token) return;
    if (!content.trim() && composeImages.length === 0) {
      setComposeError('Add a caption or at least one photo');
      return;
    }
    setComposeBusy(true);
    setComposeError('');
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({
          category: postCategory,
          content: content.trim(),
          images: composeImages,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setComposeError('Session expired. Please log in again.');
          setTimeout(() => { location.href = '/login'; }, 1000);
          return;
        }
        setComposeError(data.error || 'Failed to publish');
        return;
      }
      setContent('');
      setComposeImages([]);
      setShowCompose(false);
      // After publishing, refetch from page 1 to put the new post at the top
      setPage(1);
      setTotalPages(1);
      await loadPosts(category, 1, false);
    } catch {
      setComposeError('Network error. Please try again.');
    } finally {
      setComposeBusy(false);
    }
  }

  const composeKb = Math.round(composeImages.reduce((s, x) => s + x.length, 0) / 1024);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-2 pb-12 space-y-5">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" variants={fadeIn} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-text-primary">Community</h1>
          <p className="text-sm text-text-secondary mt-1">Share your journey</p>
        </div>
        {token && (
          <button onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-sm font-semibold shadow-md shadow-accent/30 hover:bg-accent-hover transition active:scale-[0.98]">
            <Plus size={15} /> New post
          </button>
        )}
      </motion.div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition active:scale-[0.98]
              ${category === cat.id
                ? 'bg-accent text-white shadow shadow-accent/25'
                : 'bg-bg-card text-text-secondary border border-border hover:border-border-hover'}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {!token && (
        <div className="rounded-2xl glass px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-text-secondary">Connect your wallet to post and like.</p>
          <a href="/login" className="text-xs font-semibold text-accent hover:text-accent-hover">Connect →</a>
        </div>
      )}

      {/* Feed */}
      <div className="space-y-5">
        {postsLoading && posts.length === 0 ? (
          // Skeleton placeholders that mirror the real post card so the layout doesn't jump
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton hideImage />
          </>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <ImagePlus size={36} className="mx-auto mb-3 text-text-muted opacity-40" />
            <p className="text-text-secondary">No posts yet. Be the first to share!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard key={post.id} post={post} token={token} />
          ))
        )}

        {/* Infinite-scroll sentinel + loading-more / end-of-feed indicators */}
        {posts.length > 0 && (
          <>
            {hasMore && <div ref={sentinelRef} className="h-1" />}
            {loadingMore && (
              <div className="flex items-center justify-center gap-3 py-6 text-text-muted text-sm">
                <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                Loading more posts…
              </div>
            )}
            {!hasMore && !loadingMore && posts.length >= 5 && (
              <p className="text-center text-xs text-text-muted py-8">— You're all caught up —</p>
            )}
          </>
        )}
      </div>

      {/* Compose modal */}
      <AnimatePresence>
        {showCompose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-bg-card rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl border border-border">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
                <button onClick={() => { setShowCompose(false); setComposeError(''); }}
                  className="text-text-secondary hover:text-text-primary transition text-sm">
                  Cancel
                </button>
                <p className="text-base font-semibold text-text-primary">New post</p>
                <button onClick={publishPost}
                  disabled={composeBusy || (!content.trim() && composeImages.length === 0)}
                  className="text-accent font-semibold text-sm disabled:opacity-30">
                  {composeBusy ? 'Posting...' : 'Share'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {['general', 'challenge', 'diary', 'tips'].map(c => (
                    <button key={c} onClick={() => setPostCategory(c)}
                      className={`px-3 py-1.5 rounded-full text-xs capitalize transition active:scale-[0.98] ${
                        postCategory === c
                          ? 'bg-accent text-white shadow shadow-accent/25'
                          : 'bg-bg border border-border text-text-secondary'
                      }`}>
                      {c}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {composeImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {composeImages.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-bg group">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/65 text-white flex items-center justify-center opacity-90 hover:opacity-100 transition">
                            <X size={14} />
                          </button>
                          {i === 0 && composeImages.length > 1 && (
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">Cover</span>
                          )}
                        </div>
                      ))}
                      {composeImages.length < MAX_IMAGES && (
                        <button onClick={() => fileInputRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent text-text-muted hover:text-accent flex flex-col items-center justify-center transition">
                          <Plus size={20} />
                          <span className="text-[10px] mt-1">Add</span>
                        </button>
                      )}
                    </div>
                  )}
                  {composeImages.length === 0 && (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-border hover:border-accent text-text-muted hover:text-accent flex flex-col items-center justify-center transition">
                      <ImagePlus size={28} />
                      <span className="text-sm mt-2 font-medium">Add photos</span>
                      <span className="text-xs text-text-muted mt-1">Up to {MAX_IMAGES} · auto-resized</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={pickFiles} />
                  {composeImages.length > 0 && (
                    <p className="text-[11px] text-text-muted">{composeImages.length} photo{composeImages.length === 1 ? '' : 's'} · {composeKb} KB</p>
                  )}
                </div>

                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={me?.displayName ? `What's on your mind, ${me.displayName}?` : "What's on your mind?"}
                  rows={5}
                  className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:outline-none resize-none" />

                {composeError && (
                  <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{composeError}</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
