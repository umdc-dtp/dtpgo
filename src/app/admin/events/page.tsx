import { Metadata } from 'next';
import { Suspense } from 'react';
import { EventManagementSplitPane } from '@/components/admin/EventManagementSplitPane';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { EventStatsCards } from '@/components/admin/EventStatsCards';

export const metadata: Metadata = {
  title: 'Event Management | DTP Attendance Admin',
  description: 'Manage events, sessions, and organizer assignments for the DTP Attendance system',
};

export default function AdminEventsPage() {
  return (
    <div className="w-full min-w-0 max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Event Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create and manage events, sessions, and organizer assignments
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="h-4 w-4" />
          <span>Admin Portal</span>
        </div>
      </div>

      {/* Quick Stats */}
      <EventStatsCards />

      {/* Split Pane Management */}
      <Suspense fallback={
        <Card>
          <CardHeader>
            <CardTitle>Loading Events...</CardTitle>
            <CardDescription>Please wait while we load the event management interface.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </CardContent>
        </Card>
      }>
        <EventManagementSplitPane />
      </Suspense>
    </div>
  );
}
