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

export interface AttendanceStudentPreview {
  studentIdNumber: string;
  firstName: string;
  lastName: string;
}

const CACHE_TTL_SECONDS = 300;
const DIRECTORY_TTL_MS = 5 * 60_000;
let directory: Map<string, AttendanceStudentLookup> | null = null;
let directoryExpiresAt = 0;
let warmupPromise: Promise<void> | null = null;
let directoryVersion = 0;

export function invalidateAttendanceStudentLookup(studentIdNumber: string): void {
  directory?.delete(studentIdNumber);
  directoryExpiresAt = 0;
  directoryVersion += 1;
  revalidateTag(`attendance:student:${studentIdNumber}`);
}

// Load the complete student roster into the server process. Database writes
// remain authoritative; this map only removes the student lookup round trip.
export function warmAttendanceStudentLookup(): Promise<void> {
  if (directory && Date.now() < directoryExpiresAt) return Promise.resolve();
  if (warmupPromise) return warmupPromise;
  const version = directoryVersion;
  warmupPromise = prisma.student.findMany({
    select: {
      id: true,
      studentIdNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      year: true,
      program: { select: { name: true } },
    },
  }).then(students => {
    if (version !== directoryVersion) return;
    directory = new Map(students.map(student => [student.studentIdNumber, student]));
    directoryExpiresAt = Date.now() + DIRECTORY_TTL_MS;
  }).finally(() => { warmupPromise = null; });
  return warmupPromise;
}

export function getAttendanceStudentPreview(): AttendanceStudentPreview[] | null {
  if (!directory || Date.now() >= directoryExpiresAt) return null;
  return Array.from(directory.values(), ({ studentIdNumber, firstName, lastName }) => ({
    studentIdNumber,
    firstName,
    lastName,
  }));
}

export async function getAttendanceStudentByStudentId(
  studentIdNumber: string
): Promise<AttendanceStudentLookup | null> {
  if (directory && Date.now() < directoryExpiresAt) {
    const student = directory.get(studentIdNumber);
    if (student) return student;
  }
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
