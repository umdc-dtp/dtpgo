import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { authenticateAdminApi, createAuthErrorResponse } from '@/lib/auth/api-auth'
import { prisma } from '@/lib/db/client'
import { createManualInvitation } from '@/lib/invitations/manual-invitation'
import { z } from 'zod'

// Validation schema for organizer invitation
const inviteOrganizerSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['organizer', 'admin']).default('organizer'),
  assignedEvents: z.array(z.string()).optional().default([]),
})

export async function POST(request: NextRequest) {
  try {
    // Authenticate admin user
    const authResult = await authenticateAdminApi(request)
    if (!authResult.success) {
      return createAuthErrorResponse(authResult)
    }

    const adminUser = authResult.user!
    const body = await request.json()

    // Validate request body
    const validationResult = inviteOrganizerSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      )
    }

    const { email, fullName, role, assignedEvents } = validationResult.data

    // Check if organizer already exists
    const existingOrganizer = await prisma.organizer.findUnique({
      where: { email },
    })

    if (existingOrganizer) {
      return NextResponse.json(
        {
          error: 'Organizer already exists',
          message: 'An organizer with this email address already exists.',
        },
        { status: 409 }
      )
    }

    // Validate assigned events if provided
    if (assignedEvents.length > 0) {
      const validEvents = await prisma.event.findMany({
        where: {
          id: { in: assignedEvents },
          isActive: true,
        },
        select: { id: true },
      })

      if (validEvents.length !== assignedEvents.length) {
        return NextResponse.json(
          {
            error: 'Invalid events',
            message: 'One or more assigned events are invalid or inactive.',
          },
          { status: 400 }
        )
      }
    }

    const token = crypto.randomBytes(32).toString('base64url')
    const invitationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48)

    const organizer = await prisma.$transaction(async tx => {
      const createdOrganizer = await tx.organizer.create({
        data: {
          email,
          fullName,
          role,
          invitedBy: adminUser.id,
          invitedAt: new Date(),
          invitationToken: token,
          invitationExpiresAt,
        },
      })

      if (assignedEvents.length > 0) {
        await tx.organizerEventAssignment.createMany({
          data: assignedEvents.map(eventId => ({
            organizerId: createdOrganizer.id,
            eventId,
            assignedBy: adminUser.id,
          })),
        })
      }

      await tx.activity.create({
        data: {
          type: 'admin_action',
          action: 'invite_organizer',
          description: `Admin ${adminUser.email} invited organizer ${email} with role ${role}`,
          organizerId: createdOrganizer.id,
          userId: adminUser.id,
          metadata: { organizerEmail: email, organizerName: fullName, role, assignedEvents },
          source: 'admin',
          category: 'authentication',
          severity: 'info',
        },
      })

      return createdOrganizer
    })

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const manualInvitation = createManualInvitation(origin, token)

    return NextResponse.json(
      {
        success: true,
        message: 'Organizer invitation link created successfully',
        ...manualInvitation,
        organizer: {
          id: organizer.id,
          email: organizer.email,
          fullName: organizer.fullName,
          role: organizer.role,
          invitedAt: organizer.invitedAt,
        },
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error inviting organizer:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to create organizer invitation',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate admin user
    const authResult = await authenticateAdminApi(request)
    if (!authResult.success) {
      return createAuthErrorResponse(authResult)
    }

    // Get all organizers with their assignments
    const organizers = await prisma.organizer.findMany({
      include: {
        eventAssignments: {
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      organizers: organizers.map(organizer => ({
        id: organizer.id,
        email: organizer.email,
        fullName: organizer.fullName,
        role: organizer.role,
        isActive: organizer.isActive,
        invitedBy: organizer.invitedBy,
        invitedAt: organizer.invitedAt,
        lastLoginAt: organizer.lastLoginAt,
        createdAt: organizer.createdAt,
        assignedEvents: organizer.eventAssignments.map(assignment => ({
          id: assignment.event.id,
          name: assignment.event.name,
          startDate: assignment.event.startDate,
          endDate: assignment.event.endDate,
          isActive: assignment.event.isActive,
          assignedAt: assignment.assignedAt,
        })),
      })),
    })

  } catch (error) {
    console.error('Error fetching organizers:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch organizers',
      },
      { status: 500 }
    )
  }
}
