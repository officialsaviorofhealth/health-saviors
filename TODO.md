# Health Saviors — Project Module Guide

> **Updated:** 2026-04-08
> **Stack:** Next.js 14 · Hono · Prisma · Groq (Llama 3.3 70B) · RainbowKit · Vercel · Neon PostgreSQL

---

## Using the New Modules

### Module A. Daily Health Log (`/log`)

Record your daily health activities and earn points.

**Page:** `/log`
**API endpoints:**

| Endpoint | Method | Request body | Description |
|-----------|--------|----------|------|
| `/api/logs/water` | `POST` | `{ "amountMl": 250 }` | Log water intake (default 250ml) |
| `/api/logs/water` | `GET` | `?date=2026-04-08` | Get today's water logs + total |
| `/api/logs/meal` | `POST` | `{ "mealType": "lunch", "description": "Grilled chicken salad", "calories": 450 }` | Log a meal (calories optional — can be AI-estimated) |
| `/api/logs/meal` | `GET` | `?date=2026-04-08` | Get today's meals + total calories |
| `/api/logs/exercise` | `POST` | `{ "exerciseType": "walking", "durationMin": 30, "distanceKm": 2.5 }` | Log exercise |
| `/api/logs/exercise` | `GET` | `?date=2026-04-08` | Get today's exercise + total |
| `/api/logs/sleep` | `POST` | `{ "bedtime": "2026-04-07T23:00:00Z", "wakeTime": "2026-04-08T07:00:00Z", "quality": 4 }` | Log sleep (quality 1-5) |
| `/api/logs/sleep` | `GET` | `?date=2026-04-08` | Get today's sleep log |
| `/api/logs/mood` | `POST` | `{ "score": 4, "note": "Feeling good today" }` | Log mood (1-5: 😫😟😐🙂😄) |
| `/api/logs/mood` | `GET` | `?date=2026-04-08` | Get today's mood log |

**Points earned:**
- Water: +10 per cup, +50 bonus when the 2L goal is reached
- Meal: +30 per log
- Exercise: +50 per log
- Sleep: +20 per log
- Mood: +10 per log

**All endpoints** require an `Authorization: Bearer <JWT>` header.

---

### Module B. Dashboard (`/dashboard`)

Visualize health data as charts and trends.

**Page:** `/dashboard`
**API endpoints:**

| Endpoint | Method | Parameters | Description |
|-----------|--------|---------|------|
| `/api/logs/summary` | `GET` | `?range=day&date=2026-04-08` | Get aggregated summary data |

**Range options:** `day`, `week`, `month`

**Response data:**
- `water` — total ml, number of cups, whether the goal was met
- `meals` — meal list, total calories, count
- `exercise` — exercise list, total duration (min), total distance (km)
- `sleep` — sleep log
- `mood` — mood logs, average score
- `meditation` — meditation logs, total duration (min)
- `points` — current H2E point balance

**Charts (Recharts library):**
- Water intake (Area chart, 7 days)
- Exercise duration (Bar chart, 7 days)
- Calories (Area chart, 7 days)
- Mood trend (Area chart, 7 days)

---

### Module E. Mindfulness Program (`/mindfulness`)

Provides guided meditation, breathing exercises, and curated content.

**Page:** `/mindfulness`
**API endpoints:**

| Endpoint | Method | Request body | Description |
|-----------|--------|----------|------|
| `/api/logs/meditation` | `POST` | `{ "durationMin": 10, "sessionType": "breathing" }` | Save a completed meditation session |
| `/api/logs/meditation` | `GET` | `?date=2026-04-08` | Get today's meditation logs |

**Session types:**
- `breathing` — 4-4-6-2 breathing pattern + visual guide (default 5 min)
- `body_scan` — progressive relaxation meditation (default 10 min)
- `guided` — AI-guided meditation (default 15 min)
- `free` — unguided free meditation (default 10 min)

**Timer durations:** 5, 10, 15, or 30 minutes

**Features:**
- Circular progress timer + animated ring
- Real-time breathing guidance ("Breathe in... hold... breathe out...")
- Auto-save on session completion (+40 points)
- Curated YouTube links for meditation music and guided videos

---

### Module H. Community (`/community`)

A social board with posts, comments, likes, and category filters.

**Page:** `/community`
**API endpoints:**

| Endpoint | Method | Request body | Description |
|-----------|--------|----------|------|
| `/api/community` | `GET` | `?category=general&page=1` | Post list (20 per page) |
| `/api/community` | `POST` | `{ "category": "diary", "title": "Day 5", "content": "..." }` | Create a post (+20 points) |
| `/api/community/[postId]/comments` | `GET` | — | Get comments on a post |
| `/api/community/[postId]/comments` | `POST` | `{ "content": "You're doing great!" }` | Add a comment |
| `/api/community/[postId]/like` | `POST` | — | Toggle like (press to like / press again to unlike) |

**Categories:** `general`, `challenge`, `diary`, `tips`

**Features:**
- Category filter tabs
- Post list (shows author wallet address, like count, comment count)
- Post detail view + comments + like button
- Inline comment input
- Authors are shown by wallet address (0x1234...5678)

---

## Points System (H2E) — Streak-Based

Instead of awarding points for every log, the system rewards you for maintaining a **streak** of consecutive logging days.

**Streak rewards:**

| Condition | Points | Description |
|------|--------|------|
| Every 3 days | +100 | Awarded at each 3-, 6-, 9-, 12-day... streak |
| 10-day streak | +500 | Milestone bonus (one-time) |
| 30-day streak | +2,000 | Milestone bonus (one-time) |
| 100-day streak | +10,000 | Milestone bonus (one-time) |
| Community post | +20 | On creating a post (separate) |

**How streaks are calculated:**
- Logging any single activity in a day counts that day toward the streak
- Activity types: water, meal, exercise, sleep, mood, meditation (any of them)
- If you haven't logged today, the streak is not broken yet — there's a one-day grace period
- Missing a full day resets the streak

**Reward timing:**
- The streak is checked automatically when you log → rewards are granted immediately when conditions are met
- Duplicate awards on the same day are prevented (checked only once per day)

**Balance:** Shown on the dashboard page, stored in the `users.token_balance` column

---

## DB Schema (New Tables)

```
water_logs         — id, user_id, amount_ml, created_at
meal_logs          — id, user_id, meal_type, description, calories, protein, carbs, fat, photo_url, created_at
exercise_logs      — id, user_id, exercise_type, duration_min, distance_km, calories, intensity, created_at
sleep_logs         — id, user_id, bedtime, wake_time, quality, created_at
mood_logs          — id, user_id, score, note, created_at
meditation_logs    — id, user_id, duration_min, session_type, note, created_at
community_posts    — id, user_id, category, title, content, image_url, created_at, updated_at
community_comments — id, post_id, user_id, content, created_at
community_likes    — id, post_id, user_id, created_at (unique: post_id + user_id)
```

---

## Navigation

| Route | Page | Auth required |
|------|--------|----------|
| `/` | Landing page | No |
| `/login` | Wallet connect (RainbowKit) | No |
| `/signup` | Profile setup | Yes |
| `/chat` | AI agent consultation | Yes |
| `/log` | Daily health log | Yes |
| `/dashboard` | Health dashboard + charts | Yes |
| `/mindfulness` | Mindfulness hub | Yes |
| `/community` | Community board | Partial (read: not required, write: required) |
| `/guide` | About page | No |

---

## Environment Variables

```env
DATABASE_URL=postgresql://...                      # Neon PostgreSQL database
JWT_SECRET=health-saviors-jwt-...                  # JWT signing key
GROQ_API_KEY=gsk_...                               # Groq API (for the AI agent)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=534c5da8...   # WalletConnect project ID
```

---

## Deployment

```bash
# Run locally
npm run dev                          # Starts web (3000) + API (3001) together

# Deploy to Vercel
vercel --prod --yes --name health-saviors-v3

# Sync the DB
DATABASE_URL="..." npx prisma db push --schema=packages/prisma/schema.prisma
DATABASE_URL="..." npx prisma generate --schema=packages/prisma/schema.prisma
```

---

## Live URLs

- **Vercel:** https://health-saviors-v3.vercel.app
- **Local:** http://localhost:3000
