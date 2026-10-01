import { NextRequest, NextResponse } from 'next/server';
// import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest, ApiAuthResult } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/queries/activity';
import { createSessionSchema, sessionConflictCheckSchema, sessionQuerySchema } from '@/lib/validations/session';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Authenticate admin request
    const authResult = await authenticateApiRequest(request, {
      requiredRole: 'admin',
      requireAuth: true,
    });

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: authResult.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const queryValidation = sessionQuerySchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      eventId: searchParams.get('eventId'),
      search: searchParams.get('search'),
      isActive: searchParams.get('isActive'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const { page, limit, eventId, search, isActive, sortBy, sortOrder } = queryValidation.data;

    // Build where clause
    const whereClause: Record<string, unknown> = {};
    
    if (eventId) {
      whereClause.eventId = eventId;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive;
    }

    // Build orderBy clause
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    // Get total count for pagination
    const totalCount = await prisma.session.count({ where: whereClause });

    // Get sessions with pagination
    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            attendance: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      sessions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch sessions',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  let authResult: ApiAuthResult | undefined;
  let body: Record<string, unknown> | undefined;

  try {
    // Check if this is a conflict check request
    const { searchParams } = new URL(request.url);
    const isConflictCheck = searchParams.get('checkConflicts') === 'true';

    // Authenticate admin request
    authResult = await authenticateApiRequest(request, {
      requiredRole: 'admin',
      requireAuth: true,
    });

    if (!authResult.success) {
      await logActivity({
        type: 'system_event',
        action: 'session_creation_failed',
        description: `Unauthorized attempt to create session`,
        severity: 'warning',
        category: 'authentication',
        metadata: { ipAddress, userAgent, error: authResult.error },
        userId: undefined,
      });
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: authResult.statusCode || 401 }
      );
    }

    if (!authResult.user) {
      await logActivity({
        type: 'system_event',
        action: 'session_creation_failed',
        description: `No user found in authentication result for session creation`,
        severity: 'error',
        category: 'authentication',
        metadata: { ipAddress, userAgent },
      });
      return NextResponse.json(
        { error: 'User not found in authentication result' },
        { status: 401 }
      );
    }

    const adminUser = authResult.user;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Use appropriate validation schema based on request type
    const validationResult = isConflictCheck 
      ? sessionConflictCheckSchema.safeParse(body!)
      : createSessionSchema.safeParse(body!);
      
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { 
      name, 
      description, 
      eventId, 
      timeInStart, 
      timeInEnd, 
      timeOutStart, 
      timeOutEnd, 
      hasTimeout,
      organizerIds,
      maxCapacity,
      allowWalkIns,
      requireRegistration
    } = validationResult.data;

    // For conflict checking, we only need to verify the event exists and check for conflicts
    if (isConflictCheck) {
      // Verify event exists and is active
      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return NextResponse.json(
          { error: 'Event not found' },
          { status: 404 }
        );
      }

      if (!event.isActive) {
        return NextResponse.json(
          { error: 'Cannot create session for inactive event' },
          { status: 400 }
        );
      }

      // Check for time window conflicts with existing sessions
      const whereClause: Prisma.SessionWhereInput = {
        eventId,
        isActive: true,
        OR: [
          // Time-in window conflicts
          {
            AND: [
              { timeInStart: { lte: new Date(timeInEnd) } },
              { timeInEnd: { gte: new Date(timeInStart) } },
            ],
          },
        ],
      };

      // Add time-out window conflicts if both sessions have time-out windows
      if (hasTimeout && timeOutStart && timeOutEnd) {
        whereClause.OR = whereClause.OR || [];
        whereClause.OR.push({
          AND: [
            { timeOutStart: { not: null } },
            { timeOutEnd: { not: null } },
            { timeOutStart: { lte: new Date(timeOutEnd) } },
            { timeOutEnd: { gte: new Date(timeOutStart) } },
          ],
        } as Prisma.SessionWhereInput);
      }

      const conflictingSessions = await prisma.session.findMany({
        where: whereClause,
      });

      if (conflictingSessions.length > 0) {
        return NextResponse.json(
          { 
            error: 'Session time windows conflict with existing sessions',
            conflictingSessions: conflictingSessions.map(s => s.name),
          },
          { status: 409 }
        );
      }

      // No conflicts found
      return NextResponse.json(
        { success: true, message: 'No conflicts found' },
        { status: 200 }
      );
    }

    // TODO: Implement session-organizer relationship and additional fields in database schema
    // For now, we'll log the additional fields but not store them in the database
    console.log('Session creation - additional fields received:', {
      organizerIds,
      maxCapacity,
      allowWalkIns,
      requireRegistration
    });

    // Verify event exists and is active
    console.log('Looking up event with ID:', eventId);
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    console.log('Event found:', event ? 'Yes' : 'No');

    if (!event) {
      await logActivity({
        type: 'system_event',
        action: 'session_creation_failed',
        description: `Attempt to create session for non-existent event: ${eventId}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { createdBy: adminUser.id, eventId, sessionName: name, ipAddress, userAgent },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (!event.isActive) {
      await logActivity({
        type: 'system_event',
        action: 'session_creation_failed',
        description: `Attempt to create session for inactive event: ${event.name}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { createdBy: adminUser.id, eventId, eventName: event.name, sessionName: name, ipAddress, userAgent },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'Cannot create session for inactive event' },
        { status: 400 }
      );
    }

    // Check for duplicate session names within the same event
    const existingSession = await prisma.session.findFirst({
      where: {
        eventId,
        name: { equals: name, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (existingSession) {
      await logActivity({
        type: 'system_event',
        action: 'session_creation_failed',
        description: `Attempt to create duplicate session: ${name} in event ${event.name}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { createdBy: adminUser.id, eventId, eventName: event.name, sessionName: name, ipAddress, userAgent },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'A session with this name already exists in this event' },
        { status: 409 }
      );
    }

    // Check for time window conflicts with existing sessions
    const whereClause: Prisma.SessionWhereInput = {
      eventId,
      isActive: true,
      OR: [
        // Time-in window conflicts
        {
          AND: [
            { timeInStart: { lte: new Date(timeInEnd) } },
            { timeInEnd: { gte: new Date(timeInStart) } },
          ],
        },
      ],
    };

    // Add time-out window conflicts if both sessions have time-out windows
    if (hasTimeout && timeOutStart && timeOutEnd) {
      whereClause.OR = whereClause.OR || [];
      whereClause.OR.push({
        AND: [
          { timeOutStart: { not: null } },
          { timeOutEnd: { not: null } },
          { timeOutStart: { lte: new Date(timeOutEnd) } },
          { timeOutEnd: { gte: new Date(timeOutStart) } },
        ],
      } as Prisma.SessionWhereInput);
    }

    const conflictingSessions = await prisma.session.findMany({
      where: whereClause,
    });

    if (conflictingSessions.length > 0) {
      await logActivity({
        type: 'system_event',
        action: 'session_creation_failed',
        description: `Attempt to create session with conflicting time windows: ${name}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { 
          createdBy: adminUser.id, 
          eventId, 
          sessionName: name, 
          conflictingSessions: conflictingSessions.map(s => s.name),
          ipAddress, 
          userAgent 
        },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { 
          error: 'Session time windows conflict with existing sessions',
          conflictingSessions: conflictingSessions.map(s => s.name),
        },
        { status: 409 }
      );
    }

    // Create session
    console.log('Preparing session data...');
    const sessionData: Record<string, unknown> = {
      name,
      description,
      event: { connect: { id: eventId } },
      timeInStart: new Date(timeInStart),
      timeInEnd: new Date(timeInEnd),
    };

    // Only add timeout fields if hasTimeout is true and values are provided
    if (hasTimeout && timeOutStart && timeOutEnd) {
      sessionData.timeOutStart = new Date(timeOutStart);
      sessionData.timeOutEnd = new Date(timeOutEnd);
    }

    console.log('Session data prepared:', sessionData);
    console.log('Creating session in database...');
    
    const newSession = await prisma.session.create({
      data: sessionData as Prisma.SessionCreateInput,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            attendance: true,
          },
        },
      },
    });
    console.log('Session created successfully:', newSession.id);

    try {
      await logActivity({
      type: 'admin_action',
      action: 'session_created',
      description: `Admin ${adminUser.email} created new session: ${name} for event ${event.name}`,
      severity: 'info',
      category: 'data_management',
      metadata: {
        sessionId: newSession.id,
        sessionName: name,
        eventId: event.id,
        eventName: event.name,
        timeInStart: new Date(timeInStart).toISOString(),
        timeInEnd: new Date(timeInEnd).toISOString(),
        timeOutStart: hasTimeout && timeOutStart ? new Date(timeOutStart).toISOString() : null,
        timeOutEnd: hasTimeout && timeOutEnd ? new Date(timeOutEnd).toISOString() : null,
        hasTimeout: hasTimeout || false,
        creationDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: adminUser.id,
      });
    } catch (logError) {
      console.error('Session created, but activity logging failed:', logError);
    }

    return NextResponse.json(
      { 
        success: true,
        message: 'Session created successfully',
        session: newSession,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating session:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Session data that caused error:', body);
    
    try {
      await logActivity({
      type: 'system_event',
      action: 'session_creation_failed',
      description: `Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      category: 'system',
      metadata: {
        createdBy: authResult?.user?.id,
        sessionData: body,
        errorMessage: error instanceof Error ? error.message : 'Unknown',
        errorStack: error instanceof Error ? error.stack : 'No stack trace',
        creationDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: authResult?.user?.id,
      });
    } catch (logError) {
      console.error('Failed to log session creation error:', logError);
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
