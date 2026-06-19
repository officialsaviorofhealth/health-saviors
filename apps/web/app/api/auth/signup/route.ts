import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'Deprecated. Use /api/auth/wallet instead.' }, { status: 410 });
}
