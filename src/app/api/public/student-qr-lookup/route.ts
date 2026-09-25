import { NextRequest, NextResponse } from 'next/server';
import { createBrandedQRCode } from '@/lib/qr/branding';
import { prisma } from '@/lib/db/client';
import { withRateLimit } from '@/lib/auth/rate-limit';
import { namesMatch, normalizeNameParts } from '@/lib/student-name-matching';

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');

export const POST = withRateLimit('api', async (request: NextRequest) => {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? normalize(body.name) : '';
    const studentIdNumber = typeof body?.studentIdNumber === 'string'
      ? body.studentIdNumber.trim()
      : '';

    if (!name || !studentIdNumber) {
      return NextResponse.json(
        { error: 'Student name and student ID number are required.' },
        { status: 400 }
      );
    }

    if (name.length > 255 || studentIdNumber.length > 100) {
      return NextResponse.json(
        { error: 'Please enter a valid student name and student ID number.' },
        { status: 400 }
      );
    }

    if (normalizeNameParts(name).length < 2) {
      return NextResponse.json(
        { error: 'Please enter your first and last name.' },
        { status: 400 }
      );
    }

    // Use the exact ID as the database lookup key, then verify the submitted name.
    const candidates = await prisma.student.findMany({
      where: {
        studentIdNumber,
      },
      select: {
        firstName: true,
        lastName: true,
        studentIdNumber: true,
      },
    });

    const student = candidates.length === 1 && namesMatch(
      `${candidates[0].firstName} ${candidates[0].lastName}`,
      name
    )
      ? candidates[0]
      : null;

    if (!student) {
      return NextResponse.json(
        { error: 'Student record not found. Please check your name and student ID number.' },
        { status: 404 }
      );
    }

    const studentName = normalize(`${student.firstName} ${student.lastName}`);
    const qrCodeBuffer = await createBrandedQRCode({
      name: studentName,
      studentId: student.studentIdNumber,
    });

    return NextResponse.json({
      studentName,
      studentIdNumber: student.studentIdNumber,
      qrCode: `data:image/png;base64,${qrCodeBuffer.toString('base64')}`,
    });
  } catch (error) {
    console.error('Student QR lookup failed:', error);
    return NextResponse.json(
      { error: 'Unable to retrieve your QR code right now. Please try again later.' },
      { status: 500 }
    );
  }
});
