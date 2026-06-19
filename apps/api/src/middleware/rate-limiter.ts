import { Context, Next } from "hono";
const counts = new Map<string, { c: number; r: number }>();
export const rateLimiter = async (c: Context, next: Next) => {
  const k = c.req.header("x-forwarded-for") || "x";
  const now = Date.now(); const e = counts.get(k);
  if (e && now < e.r && e.c >= 60) return c.json({ error: "Rate limited" }, 429);
  counts.set(k, { c: (e?.c || 0) + 1, r: e?.r || now + 60000 });
  await next();
};
