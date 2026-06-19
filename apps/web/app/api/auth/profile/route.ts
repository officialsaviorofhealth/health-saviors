import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { createPatient } from '@/lib/fhir';

const VALID_CONDITIONS = [
  'diabetes', 'hypertension', 'heart_disease', 'asthma_copd',
  'arthritis', 'depression_anxiety', 'allergies', 'obesity',
  'thyroid', 'kidney_disease', 'none',
];

export async function POST(request: NextRequest) {
  try {
    const payload = getUserFromRequest(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { displayName, age, heightCm, weightKg, chronicConditions, dataConsent } = body;

    // Validation
    if (!age || !heightCm || !weightKg) {
      return NextResponse.json({ error: 'age, heightCm, and weightKg are required' }, { status: 400 });
    }
    if (typeof age !== 'number' || age < 1 || age > 150) {
      return NextResponse.json({ error: 'Invalid age (must be 1-150)' }, { status: 400 });
    }
    if (typeof heightCm !== 'number' || heightCm < 50 || heightCm > 300) {
      return NextResponse.json({ error: 'Invalid height (must be 50-300 cm)' }, { status: 400 });
    }
    if (typeof weightKg !== 'number' || weightKg < 10 || weightKg > 500) {
      return NextResponse.json({ error: 'Invalid weight (must be 10-500 kg)' }, { status: 400 });
    }
    const trimmedName = typeof displayName === 'string' ? displayName.trim() : '';
    if (trimmedName && (trimmedName.length < 2 || trimmedName.length > 50)) {
      return NextResponse.json({ error: 'Display name must be 2-50 characters' }, { status: 400 });
    }

    // Update user profile
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        displayName: trimmedName || null,
        age,
        heightCm,
        weightKg,
        dataConsent: dataConsent || false,
        profileComplete: true,
      },
    });

    // Save chronic conditions
    if (chronicConditions && Array.isArray(chronicConditions)) {
      // Remove existing conditions first (in case of profile re-submission)
      await prisma.userChronicCondition.deleteMany({
        where: { userId: user.id },
      });

      const validConditions = chronicConditions.filter(
        (c: string) => VALID_CONDITIONS.includes(c) && c !== 'none'
      );
      if (validConditions.length > 0) {
        await prisma.userChronicCondition.createMany({
          data: validConditions.map((code: string) => ({
            userId: user.id,
            conditionCode: code,
            conditionName: code.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            isActive: true,
          })),
        });
      }
    }

    // Create FHIR Patient resource
    await prisma.healthRecord.create({
      data: {
        userId: user.id,
        resourceType: 'Patient',
        fhirResource: createPatient({ id: user.id, age, heightCm, weightKg }),
        sourceAgent: 'system',
      },
    });

    // Record consent
    if (dataConsent) {
      await prisma.consentLog.create({
        data: {
          userId: user.id,
          consentType: 'health_data_collection',
          granted: true,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    }

    // Fetch updated data for response
    const savedConditions = await prisma.userChronicCondition.findMany({
      where: { userId: user.id },
    });

    return NextResponse.json({
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
        chronicConditions: savedConditions.map(c => c.conditionCode),
      },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
