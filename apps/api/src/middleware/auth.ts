import { Context, Next } from "hono";
import { sign, verify } from "jsonwebtoken";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "../app";

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
const JWT_EXPIRES = "7d";

// ── Password hashing helpers (Node.js built-in crypto, no native deps) ──

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, derivedBuffer);
}

// ── Strip sensitive fields from user object ──

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export const authMiddleware = {
  // GET /api/v1/auth/nonce — Generate SIWE nonce
  getNonce: async (c: Context) => {
    const nonce = `health2earn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const message = `Sign this message to authenticate with AI Health Journal.\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
    return c.json({ success: true, data: { nonce, message } });
  },

  // POST /api/v1/auth/connect — Verify wallet signature + issue JWT
  connect: async (c: Context) => {
    try {
      const { address, signature } = await c.req.json();
      if (!address || !signature) {
        return c.json({ success: false, error: { code: "MISSING_FIELDS", message: "address and signature required" } }, 400);
      }

      // Upsert user
      const user = await prisma.user.upsert({
        where: { walletAddress: address.toLowerCase() },
        update: { updatedAt: new Date() },
        create: {
          walletAddress: address.toLowerCase(),
          referralCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
        },
      });

      const token = sign(
        { userId: user.id, wallet: user.walletAddress },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            walletAddress: user.walletAddress,
            streakDays: user.streakDays,
            level: user.level,
            points: user.totalPoints,
          },
        },
      });
    } catch (error: any) {
      console.error("Auth connect error:", error);
      return c.json({ success: false, error: { code: "AUTH_ERROR", message: error.message } }, 500);
    }
  },

  // POST /api/v1/auth/register — Email/password registration
  register: async (c: Context) => {
    try {
      const { email, password, name } = await c.req.json();

      if (!email || !password) {
        return c.json({ success: false, error: { code: "MISSING_FIELDS", message: "email and password are required" } }, 400);
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return c.json({ success: false, error: { code: "INVALID_EMAIL", message: "Invalid email format" } }, 400);
      }

      // Validate password length
      if (password.length < 8) {
        return c.json({ success: false, error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" } }, 400);
      }

      // Check if email already exists
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return c.json({ success: false, error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" } }, 409);
      }

      const passwordHashValue = hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash: passwordHashValue,
          name: name || null,
          referralCode: Math.random().toString(36).slice(2, 10).toUpperCase(),
        },
      });

      const token = sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            streakDays: user.streakDays,
            level: user.level,
            points: user.totalPoints,
          },
        },
      });
    } catch (error: any) {
      console.error("Auth register error:", error);
      return c.json({ success: false, error: { code: "REGISTER_ERROR", message: error.message } }, 500);
    }
  },

  // POST /api/v1/auth/login — Email/password login
  login: async (c: Context) => {
    try {
      const { email, password } = await c.req.json();

      if (!email || !password) {
        return c.json({ success: false, error: { code: "MISSING_FIELDS", message: "email and password are required" } }, 400);
      }

      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !user.passwordHash) {
        return c.json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }, 401);
      }

      const valid = verifyPassword(password, user.passwordHash);
      if (!valid) {
        return c.json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }, 401);
      }

      const token = sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
      );

      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            streakDays: user.streakDays,
            level: user.level,
            points: user.totalPoints,
          },
        },
      });
    } catch (error: any) {
      console.error("Auth login error:", error);
      return c.json({ success: false, error: { code: "LOGIN_ERROR", message: error.message } }, 500);
    }
  },

  // GET /api/v1/auth/me — Get current user from JWT (requires auth)
  getMe: async (c: Context) => {
    try {
      const userId = c.get("userId");

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return c.json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } }, 404);
      }

      return c.json({
        success: true,
        data: {
          user: sanitizeUser(user),
        },
      });
    } catch (error: any) {
      console.error("Auth getMe error:", error);
      return c.json({ success: false, error: { code: "AUTH_ERROR", message: error.message } }, 500);
    }
  },

  // Middleware: verify JWT and set userId
  verify: async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
      if (process.env.NODE_ENV === "development") {
        c.set("userId", "dev-user-id");
        c.set("wallet", "0x0000000000000000000000000000000000000000");
        return next();
      }
      return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Missing Authorization header" } }, 401);
    }

    try {
      const token = authHeader.replace("Bearer ", "");
      const decoded = verify(token, JWT_SECRET) as { userId: string; wallet?: string; email?: string };
      c.set("userId", decoded.userId);
      if (decoded.wallet) c.set("wallet", decoded.wallet);
      if (decoded.email) c.set("email", decoded.email);
      return next();
    } catch {
      return c.json({ success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired token" } }, 401);
    }
  },
};
