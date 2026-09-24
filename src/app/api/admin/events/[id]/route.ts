import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest, ApiAuthResult } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/queries/activity';

// Validation schema for event updates
const updateEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(255, 'Event name too long').optional(),
  description: z.string().optional(),
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  location: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Get event with all related data
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { timeInStart: 'asc' },
          include: {
            _count: {
              select: {
                attendance: true,
              },
            },
          },
        },
        organizerAssignments: {
          include: {
            organizer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendance: true,
            sessions: true,
            organizerAssignments: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      event,
    });

  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch event',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  let authResult: ApiAuthResult | undefined;
  let body: Record<string, unknown> | undefined;

  try {
    // Authenticate admin request
    authResult = await authenticateApiRequest(request, {
      requiredRole: 'admin',
      requireAuth: true,
    });

    if (!authResult.success) {
      await logActivity({
        type: 'system_event',
        action: 'event_update_failed',
        description: `Unauthorized attempt to update event ${(await params).id}`,
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
        action: 'event_update_failed',
        description: `No user found in authentication result for event ${(await params).id}`,
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
    const { id } = await params;

    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      await logActivity({
        type: 'system_event',
        action: 'event_update_failed',
        description: `Attempt to update non-existent event: ${id}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { updatedBy: adminUser.id, eventId: id, ipAddress, userAgent },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate request body
    const validationResult = updateEventSchema.safeParse(body!);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // Validate date logic if dates are being updated
    if (updateData.startDate || updateData.endDate) {
      const startDate = updateData.startDate ? new Date(updateData.startDate) : existingEvent.startDate;
      const endDate = updateData.endDate ? new Date(updateData.endDate) : existingEvent.endDate;
      
      if (startDate >= endDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate event names if name is being updated
    if (updateData.name && updateData.name !== existingEvent.name) {
      const duplicateEvent = await prisma.event.findFirst({
        where: {
          name: { equals: updateData.name, mode: 'insensitive' },
          isActive: true,
          id: { not: id },
        },
      });

      if (duplicateEvent) {
        await logActivity({
          type: 'system_event',
          action: 'event_update_failed',
          description: `Attempt to update event with duplicate name: ${updateData.name}`,
          severity: 'warning',
          category: 'data_management',
          metadata: { updatedBy: adminUser.id, eventId: id, newName: updateData.name, ipAddress, userAgent },
          userId: adminUser.id,
        });
        return NextResponse.json(
          { error: 'An active event with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Update event
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...updateData,
        ...(updateData.startDate && { startDate: new Date(updateData.startDate) }),
        ...(updateData.endDate && { endDate: new Date(updateData.endDate) }),
      },
      include: {
        sessions: {
          orderBy: { timeInStart: 'asc' },
          include: {
            _count: {
              select: {
                attendance: true,
              },
            },
          },
        },
        organizerAssignments: {
          include: {
            organizer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendance: true,
            sessions: true,
            organizerAssignments: true,
          },
        },
      },
    });

    await logActivity({
      type: 'admin_action',
      action: 'event_updated',
      description: `Admin ${adminUser.email} updated event: ${updatedEvent.name}`,
      severity: 'info',
      category: 'data_management',
      metadata: {
        eventId: id,
        eventName: updatedEvent.name,
        changes: updateData,
        updateDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: adminUser.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Event updated successfully',
      event: updatedEvent,
    });

  } catch (error) {
    console.error('Error updating event:', error);
    await logActivity({
      type: 'system_event',
      action: 'event_update_failed',
      description: `Failed to update event ${(await params).id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      category: 'system',
      metadata: {
        updatedBy: authResult?.user?.id,
        eventId: (await params).id,
        updateData: body,
        errorMessage: error instanceof Error ? error.message : 'Unknown',
        updateDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: authResult?.user?.id,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to update event',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now();
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  let authResult: ApiAuthResult | undefined;

  try {
    // Authenticate admin request
    authResult = await authenticateApiRequest(request, {
      requiredRole: 'admin',
      requireAuth: true,
    });

    if (!authResult.success) {
      await logActivity({
        type: 'system_event',
        action: 'event_deletion_failed',
        description: `Unauthorized attempt to delete event ${(await params).id}`,
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
        action: 'event_deletion_failed',
        description: `No user found in authentication result for event ${(await params).id}`,
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
    const { id } = await params;

    // Check if event exists
    const existingEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            attendance: true,
            sessions: true,
          },
        },
      },
    });

    if (!existingEvent) {
      await logActivity({
        type: 'system_event',
        action: 'event_deletion_failed',
        description: `Attempt to delete non-existent event: ${id}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { deletedBy: adminUser.id, eventId: id, ipAddress, userAgent },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if event has attendance records
    if (existingEvent._count.attendance > 0) {
      await logActivity({
        type: 'system_event',
        action: 'event_deletion_failed',
        description: `Attempt to delete event with attendance records: ${existingEvent.name}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { 
          deletedBy: adminUser.id, 
          eventId: id, 
          eventName: existingEvent.name,
          attendanceCount: existingEvent._count.attendance,
          ipAddress, 
          userAgent 
        },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'Cannot delete event with existing attendance records. Deactivate the event instead.' },
        { status: 400 }
      );
    }

    // Permanently delete events without attendance records. Related sessions
    // and organizer assignments cascade, while activity logs are retained.
    const deletedEvent = await prisma.event.delete({
      where: { id },
    });

    try {
      await logActivity({
        type: 'admin_action',
        action: 'event_deleted',
        description: `Admin ${adminUser.email} deleted event: ${existingEvent.name}`,
        severity: 'info',
        category: 'data_management',
        metadata: {
          eventId: id,
          eventName: existingEvent.name,
          sessionsCount: existingEvent._count.sessions,
          deletionDuration: Date.now() - startTime,
          ipAddress,
          userAgent,
        },
        userId: adminUser.id,
      });
    } catch (activityError) {
      // Deletion has already succeeded; activity logging must not turn it into a false error.
      console.error('Failed to log event deletion activity:', activityError);
    }

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully',
      event: deletedEvent,
    });

  } catch (error) {
    console.error('Error deleting event:', error);
    await logActivity({
      type: 'system_event',
      action: 'event_deletion_failed',
      description: `Failed to delete event ${(await params).id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      category: 'system',
      metadata: {
        deletedBy: authResult?.user?.id,
        eventId: (await params).id,
        errorMessage: error instanceof Error ? error.message : 'Unknown',
        deletionDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: authResult?.user?.id,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to delete event',
      },
      { status: 500 }
    );
  }
}
