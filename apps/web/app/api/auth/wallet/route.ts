import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

// GET /api/auth/wallet?address=0x1234...
// Returns a nonce for the client to sign
export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: 'Valid Ethereum address is required' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          nonce: randomUUID(),
        },
      });
    }

    const message = `Sign this message to authenticate with Health Saviors: ${user.nonce}`;

    return NextResponse.json({ nonce: message });
  } catch (error) {
    console.error('Wallet nonce error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/auth/wallet
// Verifies signed message and returns JWT
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature } = body;

    if (!address || !signature) {
      return NextResponse.json({ error: 'Address and signature are required' }, { status: 400 });
    }

    if (!ethers.isAddress(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address' }, { status: 400 });
    }

    const normalizedAddress = address.toLowerCase();

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
      include: { chronicConditions: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Request a nonce first via GET.' }, { status: 404 });
    }

    // Verify signature using ethers v6
    const message = `Sign this message to authenticate with Health Saviors: ${user.nonce}`;
    let recoveredAddress: string;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    // Check if this is a new user (no agents yet = first login)
    const agentCount = await prisma.userAgent.count({
      where: { userId: user.id },
    });
    const isNew = agentCount === 0;

    // If new user, create 4 AI agents and record signup bonus
    if (isNew) {
      await prisma.userAgent.createMany({
        data: [
          { userId: user.id, agentType: 'nurse', nickname: 'My AI Nurse' },
          { userId: user.id, agentType: 'gatekeeper', nickname: 'My AI Gatekeeper' },
          { userId: user.id, agentType: 'nutritionist', nickname: 'My AI Nutritionist' },
          { userId: user.id, agentType: 'mindcare', nickname: 'My AI Mind Care' },
        ],
      });

      await prisma.tokenTransaction.create({
        data: {
          userId: user.id,
          amount: 20000,
          type: 'SIGNUP_BONUS',
          description: 'Welcome bonus: 20,000 H2E tokens',
        },
      });
    }

    // Rotate nonce to prevent replay attacks
    await prisma.user.update({
      where: { id: user.id },
      data: { nonce: randomUUID() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'wallet_login',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });

    // Generate JWT
    const token = signToken({ userId: user.id, walletAddress: user.walletAddress });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        profileComplete: user.profileComplete,
        age: user.age,
        heightCm: user.heightCm,
        weightKg: user.weightKg,
        tokenBalance: user.tokenBalance,
        dataConsent: user.dataConsent,
        chronicConditions: user.chronicConditions.map(c => c.conditionCode),
      },
      isNew,
    });
  } catch (error) {
    console.error('Wallet auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
