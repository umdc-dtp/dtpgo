'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InviteOrganizerForm } from '@/components/admin/InviteOrganizerForm'

export default function InviteOrganizerPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite Organizer</CardTitle>
          <CardDescription>
            Create a link to add a new organizer to the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteOrganizerForm />
        </CardContent>
      </Card>
    </div>
  )
}

