import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { authenticateAdminApi, createAuthErrorResponse } from '@/lib/auth/api-auth'
import { prisma } from '@/lib/db/client'
import { createManualInvitation } from '@/lib/invitations/manual-invitation'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateAdminApi(request)
    if (!authResult.success) {
      return createAuthErrorResponse(authResult)
    }

    const adminUser = authResult.user!
    const { id: organizerId } = await params

    const organizer = await prisma.organizer.findUnique({ where: { id: organizerId } })
    if (!organizer) {
      return NextResponse.json({ error: 'Organizer not found' }, { status: 404 })
    }

    // Generate a fresh token and expiry (48 hours)
    const token = crypto.randomBytes(32).toString('base64url')
    const invitationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48)

    await prisma.$transaction(async tx => {
      await tx.organizer.update({
        where: { id: organizerId },
        data: { invitationToken: token, invitationExpiresAt, invitedAt: new Date() },
      })

      await tx.activity.create({
        data: {
          type: 'admin_action',
          action: 'refresh_invitation_link',
          description: `Admin ${adminUser.email} refreshed the invitation link for organizer ${organizer.email}`,
          organizerId,
          userId: adminUser.id,
          metadata: { organizerEmail: organizer.email, delivery: 'manual' },
          source: 'admin',
          category: 'authentication',
          severity: 'info',
        },
      })
    })

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const manualInvitation = createManualInvitation(origin, token)

    return NextResponse.json({ success: true, ...manualInvitation })
  } catch (error) {
    console.error('Error refreshing invitation link:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to refresh organizer invitation link' },
      { status: 500 }
    )
  }
}
