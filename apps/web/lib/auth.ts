import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'health-saviors-jwt-secret-key-2024';

export interface JwtPayload {
  userId: string;
  walletAddress: string;
}

export function signToken(payload: JwtPayload): string {
  // 30 days — consumer health app, users may not open daily. Tradeoff vs security
  // accepted because the wallet signature flow makes re-auth cheap if needed.
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

export function getUserFromRequest(request: Request): JwtPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}
