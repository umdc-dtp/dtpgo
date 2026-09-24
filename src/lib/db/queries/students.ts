import { prisma } from '@/lib/db/client';
import { ScanningStudent } from '@/lib/types/scanning';

/**
 * Student with program information type
 */
export interface StudentWithProgram {
  id: string;
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  year: number;
  programId: string;
  registrationSource: string;
  createdAt: Date;
  updatedAt: Date;
  program: {
    id: string;
    name: string;
    displayName: string;
  };
}
import { invalidateAttendanceStudentLookup } from '@/lib/db/queries/attendance-student-lookup';

/**
 * Create a new student
 */
export async function createStudent(data: {
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  year: number;
  programId: string;
  registrationSource?: string;
}): Promise<StudentWithProgram | null> {
  try {
    const student = await prisma.student.create({
      data: {
        studentIdNumber: data.studentIdNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        year: data.year,
        programId: data.programId,
        registrationSource: data.registrationSource || 'admin',
      },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    invalidateAttendanceStudentLookup(student.studentIdNumber);

    return {
      id: student.id,
      studentIdNumber: student.studentIdNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      year: student.year,
      programId: student.programId,
      registrationSource: student.registrationSource,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      program: student.program,
    };

  } catch (error) {
    console.error('Error creating student:', error);
    return null;
  }
}

/**
 * Get student by ID (original function for existing codebase)
 */
export async function getStudentById(id: string): Promise<StudentWithProgram | null> {
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    return {
      id: student.id,
      studentIdNumber: student.studentIdNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      year: student.year,
      programId: student.programId,
      registrationSource: student.registrationSource,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      program: student.program,
    };

  } catch (error) {
    console.error('Error getting student by ID:', error);
    return null;
  }
}

/**
 * Get student by ID for scanning functionality
 */
export async function getScanningStudentById(id: string): Promise<ScanningStudent | null> {
  try {
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        program: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    return {
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true, // Placeholder - assume active
    };

  } catch (error) {
    console.error('Error getting student by ID:', error);
    return null;
  }
}

/**
 * Get student by student ID number (original function for existing codebase)
 */
export async function getStudentByStudentId(studentIdNumber: string): Promise<StudentWithProgram | null> {
  try {
    const student = await prisma.student.findUnique({
      where: { studentIdNumber },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    return {
      id: student.id,
      studentIdNumber: student.studentIdNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      year: student.year,
      programId: student.programId,
      registrationSource: student.registrationSource,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      program: student.program,
    };

  } catch (error) {
    console.error('Error getting student by student ID number:', error);
    return null;
  }
}

/**
 * Get student by student ID number for scanning functionality
 */
export async function getScanningStudentByStudentId(studentIdNumber: string): Promise<ScanningStudent | null> {
  try {
    const student = await prisma.student.findUnique({
      where: { studentIdNumber },
      include: {
        program: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    return {
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true, // Placeholder - assume active
    };

  } catch (error) {
    console.error('Error getting student by student ID number:', error);
    return null;
  }
}

/**
 * Get all students with pagination
 */
export async function getStudents(options: {
  page?: number;
  limit?: number;
  programId?: string;
  year?: number;
  search?: string;
  registrationSource?: string;
  dateFrom?: string;
  dateTo?: string;
  orderBy?: 'studentIdNumber' | 'firstName' | 'lastName' | 'email' | 'year' | 'createdAt';
  orderDirection?: 'asc' | 'desc';
} = {}): Promise<ScanningStudent[]> {
  try {
    const {
      page = 1,
      limit = 50,
      programId,
      year,
      search,
      registrationSource,
      dateFrom,
      dateTo,
      orderBy = 'studentIdNumber',
      orderDirection = 'asc',
    } = options;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (programId) {
      where.programId = programId;
    }

    if (year) {
      where.year = year;
    }

    if (registrationSource) {
      where.registrationSource = registrationSource;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        {
          studentIdNumber: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        program: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { [orderBy]: orderDirection },
      skip,
      take: limit,
    });

    return students.map(student => ({
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true, // Placeholder - assume active
    }));

  } catch (error) {
    console.error('Error getting students:', error);
    return [];
  }
}

/**
 * Search students by query
 */
export async function searchStudents(
  query: string,
  options: {
    limit?: number;
    programId?: string;
    year?: number;
  } = {}
): Promise<ScanningStudent[]> {
  try {
    const { limit = 10, programId, year } = options;
    
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();
    
    const where: Record<string, unknown> = {
      OR: [
        {
          studentIdNumber: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: searchTerm,
            mode: 'insensitive',
          },
        },
      ],
    };

    if (programId) {
      where.programId = programId;
    }

    if (year) {
      where.year = year;
    }

    const students = await prisma.student.findMany({
      where,
      include: {
      program: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
      take: limit,
      orderBy: [
        {
          studentIdNumber: 'asc',
        },
      ],
    });

    return students.map(student => ({
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true, // Placeholder - assume active
    }));

  } catch (error) {
    console.error('Error searching students:', error);
    return [];
  }
}

/**
 * Update student
 */
export async function updateStudent(
  id: string,
  data: {
    studentIdNumber?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    year?: number;
    programId?: string;
  }
): Promise<ScanningStudent | null> {
  try {
    const previousStudent = data.studentIdNumber
      ? await prisma.student.findUnique({
          where: { id },
          select: { studentIdNumber: true },
        })
      : null;

    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(data.studentIdNumber && { studentIdNumber: data.studentIdNumber }),
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email }),
        ...(data.year && { year: data.year }),
        ...(data.programId && { programId: data.programId }),
      },
      include: {
        program: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (previousStudent) {
      invalidateAttendanceStudentLookup(previousStudent.studentIdNumber);
    }
    invalidateAttendanceStudentLookup(student.studentIdNumber);
    return {
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true,
    };
  } catch (error) {
    console.error('Error updating student:', error);
    return null;
  }
}

/**
 * Delete student
 */
export async function deleteStudent(id: string): Promise<boolean> {
  try {
    const student = await prisma.student.delete({
      where: { id },
      select: { studentIdNumber: true },
    });
    invalidateAttendanceStudentLookup(student.studentIdNumber);
    return true;

  } catch (error) {
    console.error('Error deleting student:', error);
    return false;
  }
}

/**
 * Check if student exists by student ID number
 */
export async function studentExists(studentIdNumber: string): Promise<boolean> {
  try {
    const count = await prisma.student.count({
      where: { studentIdNumber },
    });
    return count > 0;

  } catch (error) {
    console.error('Error checking if student exists:', error);
    return false;
  }
}

/**
 * Check if student exists by email
 */
export async function studentExistsByEmail(email: string): Promise<boolean> {
  try {
    const count = await prisma.student.count({
      where: { email },
    });
    return count > 0;

  } catch (error) {
    console.error('Error checking if student exists by email:', error);
    return false;
  }
}

/**
 * Get students by program
 */
export async function getStudentsByProgram(programId: string): Promise<ScanningStudent[]> {
  try {
    const students = await prisma.student.findMany({
      where: { programId },
      include: {
        program: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { studentIdNumber: 'asc' },
    });

    return students.map(student => ({
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true, // Placeholder - assume active
    }));

  } catch (error) {
    console.error('Error getting students by program:', error);
    return [];
  }
}

/**
 * Get students by year
 */
export async function getStudentsByYear(year: number): Promise<ScanningStudent[]> {
  try {
    const students = await prisma.student.findMany({
      where: { year },
      include: {
        program: {
          select: {
            name: true,
            displayName: true,
          },
        },
      },
      orderBy: { studentIdNumber: 'asc' },
    });

    return students.map(student => ({
      id: student.id,
      studentId: student.studentIdNumber,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      program: student.program.name,
      year: student.year,
      isActive: true, // Placeholder - assume active
    }));

  } catch (error) {
    console.error('Error getting students by year:', error);
    return [];
  }
}

/**
 * Count students
 */
export async function countStudents(options: {
  programId?: string;
  year?: number;
  registrationSource?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
} = {}): Promise<number> {
  try {
    const where: Record<string, unknown> = {};
    
    if (options.programId) {
      where.programId = options.programId;
    }
    
    if (options.year) {
      where.year = options.year;
    }
    
    if (options.registrationSource) {
      where.registrationSource = options.registrationSource;
    }

    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(options.dateFrom);
      }
      if (options.dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(options.dateTo);
      }
    }

    if (options.search) {
      where.OR = [
        {
          studentIdNumber: {
            contains: options.search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: options.search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: options.search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: options.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    return await prisma.student.count({ where });

  } catch (error) {
    console.error('Error counting students:', error);
    return 0;
  }
}

/**
 * Get student statistics
 */
export async function getStudentStatistics(): Promise<{
  totalStudents: number;
  studentsByProgram: { program: string; count: number }[];
  studentsByYear: { year: number; count: number }[];
  recentRegistrations: number; // Last 30 days
}> {
  try {
    const [
      totalStudents,
      studentsByProgram,
      studentsByYear,
      recentRegistrations,
    ] = await Promise.all([
      // Total students
      prisma.student.count(),
      
      // Students by program
      prisma.student.groupBy({
        by: ['programId'],
        _count: { programId: true },
        orderBy: { _count: { programId: 'desc' } },
      }).then(async (result) => {
        const programStats = await Promise.all(
          result.map(async (stat) => {
            const program = await prisma.program.findUnique({
              where: { id: stat.programId },
              select: { name: true },
            });
            return {
              program: program?.name || 'Unknown',
              count: stat._count.programId,
            };
          })
        );
        return programStats;
      }),
      
      // Students by year
      prisma.student.groupBy({
        by: ['year'],
        _count: { year: true },
        orderBy: { year: 'asc' },
      }).then(result => result.map(stat => ({
        year: stat.year,
        count: stat._count.year,
      }))),
      
      // Recent registrations (last 30 days)
      prisma.student.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalStudents,
      studentsByProgram,
      studentsByYear,
      recentRegistrations,
    };

  } catch (error) {
    console.error('Error getting student statistics:', error);
    return {
      totalStudents: 0,
      studentsByProgram: [],
      studentsByYear: [],
      recentRegistrations: 0,
    };
  }
}

/**
 * Get student attendance history
 */
export async function getStudentAttendanceHistory(
  studentId: string,
  options: {
    limit?: number;
    eventId?: string;
    sessionId?: string;
  } = {}
): Promise<{
  attendances: Array<{
    id: string;
    sessionId: string;
    eventId: string;
    scanType: string;
    timestamp: Date;
    sessionName: string;
    eventName: string;
  }>;
  total: number;
}> {
  try {
    const { limit = 50, eventId, sessionId } = options;

    const where: Record<string, unknown> = { studentId };
    
    if (eventId) {
      where.eventId = eventId;
    }
    
    if (sessionId) {
      where.sessionId = sessionId;
    }

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          session: {
            select: {
              name: true,
            },
          },
          event: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      attendances: attendances.map(attendance => ({
        id: attendance.id,
        sessionId: attendance.sessionId,
        eventId: attendance.eventId,
        scanType: attendance.scanType,
        timestamp: attendance.createdAt,
        sessionName: attendance.session.name,
        eventName: attendance.event.name,
      })),
      total,
    };

  } catch (error) {
    console.error('Error getting student attendance history:', error);
    return {
      attendances: [],
      total: 0,
    };
  }
} 