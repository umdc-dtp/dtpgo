import { NextRequest, NextResponse } from 'next/server';
import { createBrandedQRCode } from '@/lib/qr/branding';
import { prisma } from '@/lib/db/client';
import { withRateLimit } from '@/lib/auth/rate-limit';

const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
const normalizeName = (value: string) => normalize(value)
  .replace(/[^a-z0-9 ]/gi, '')
  .toLowerCase();

export const POST = withRateLimit('api', async (request: NextRequest) => {
  try {
    const body = await request.json();
    const name = typeof body?.name === 'string' ? normalize(body.name) : '';
    const studentIdNumber = typeof body?.studentIdNumber === 'string'
      ? body.studentIdNumber.trim().replace(/\s+/g, '')
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

    if (name.split(' ').length < 2) {
      return NextResponse.json(
        { error: 'Please enter your first and last name.' },
        { status: 400 }
      );
    }

    // Find the ID candidate first, then verify the submitted name server-side.
    // This handles legacy records with extra spaces or punctuation in names.
    const candidate = await prisma.student.findUnique({
      where: {
        studentIdNumber,
      },
      select: {
        firstName: true,
        lastName: true,
        studentIdNumber: true,
      },
    });

    const student = candidate && normalizeName(`${candidate.firstName} ${candidate.lastName}`) === normalizeName(name)
      ? candidate
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
