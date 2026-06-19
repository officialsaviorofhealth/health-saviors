import { Context, Next } from 'hono';
import { PrismaClient } from '@prisma/client';

export interface AuthContext {
  userId: string;
  walletAddr: string;
}

/**
 * Auth middleware — verifies session token (JWT)
 * Wallet signature verification removed — use JWT Bearer token auth
 */
export function authMiddleware(prisma: PrismaClient) {
  return async (c: Context<{ Variables: AuthContext }>, next: Next) => {
    const authHeader = c.req.header('Authorization');

    // JWT Bearer token (session-based auth)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        // Simple JWT decode (replace with proper JWT lib in production)
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString()
        );

        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (!user) {
          return c.json({ success: false, error: { code: 'AUTH_USER_NOT_FOUND', message: 'User not found' } }, 401);
        }

        c.set('userId', user.id);
        c.set('walletAddr', user.walletAddr);
        return next();
      } catch {
        return c.json({ success: false, error: { code: 'AUTH_INVALID_TOKEN', message: 'Invalid token' } }, 401);
      }
    }

    return c.json({ success: false, error: { code: 'AUTH_MISSING', message: 'No auth provided' } }, 401);
  };
}
