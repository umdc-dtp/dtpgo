import { revalidateTag, unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db/client';

export interface AttendanceStudentLookup {
  id: string;
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  year: number;
  program: {
    name: string;
  };
}

const CACHE_TTL_SECONDS = 300;

export function invalidateAttendanceStudentLookup(studentIdNumber: string): void {
  revalidateTag(`attendance:student:${studentIdNumber}`);
}

export async function getAttendanceStudentByStudentId(
  studentIdNumber: string
): Promise<AttendanceStudentLookup | null> {
  const getCachedStudent = unstable_cache(
    async () => prisma.student.findUnique({
      where: { studentIdNumber },
      select: {
        id: true,
        studentIdNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        year: true,
        program: {
          select: {
            name: true,
          },
        },
      },
    }),
    ['attendance-student-lookup', studentIdNumber],
    {
      revalidate: CACHE_TTL_SECONDS,
      tags: [`attendance:student:${studentIdNumber}`],
    }
  );

  return getCachedStudent();
}
