/**
 * Individual Organizer Details Page
 * 
 * Displays comprehensive information about a specific organizer including
 * their profile, assignments, activity history, and management options.
 */
import React from 'react';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  Clock, 
  Shield, 
  ShieldCheck,
  Activity,
  Settings,
  Edit,
  Trash2,
  Users,
  MapPin
} from 'lucide-react';
import Link from 'next/link';

// This would be replaced with actual data fetching in a real implementation
// For now, we'll use a placeholder structure
interface OrganizerDetails {
  id: string;
  email: string;
  fullName: string;
  role: 'organizer' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  invitedBy?: string;
  invitedAt?: string;
  eventAssignments: Array<{
    id: string;
    event: {
      id: string;
      name: string;
      description?: string;
      startDate: string;
      endDate: string;
      status: string;
    };
    assignedAt: string;
  }>;
  activities: Array<{
    id: string;
    action: string;
    details: string;
    createdAt: string;
  }>;
  statistics: {
    totalAssignments: number;
    activeEvents: number;
    recentActivityCount: number;
  };
}

interface OrganizerDetailsPageProps {
  params: Promise<{ id: string }>;
}

// Placeholder function - would be replaced with actual API call
async function getOrganizerDetails(_id: string): Promise<OrganizerDetails | null> {
  // This would make an API call to fetch organizer details
  // For now, return null to trigger notFound()
  return null;
}

export default async function OrganizerDetailsPage({ params }: OrganizerDetailsPageProps) {
  const { id } = await params;
  const organizer = await getOrganizerDetails(id);

  if (!organizer) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = () => {
    if (!organizer.isActive) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    
    if (!organizer.lastLoginAt) {
      return <Badge variant="secondary">Never Logged In</Badge>;
    }
    
    const lastLogin = new Date(organizer.lastLoginAt);
    const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLogin <= 7) {
      return <Badge variant="default">Active</Badge>;
    } else if (daysSinceLogin <= 30) {
      return <Badge variant="secondary">Recently Active</Badge>;
    } else {
      return <Badge variant="outline">Inactive</Badge>;
    }
  };

  const getRoleBadge = () => {
    return organizer.role === 'admin' ? (
      <Badge variant="default" className="bg-blue-100 text-blue-800">
        <Shield className="mr-1 h-3 w-3" />
        Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Organizer
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/organizers">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Organizers
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{organizer.fullName}</h1>
            <p className="text-muted-foreground">
              Organizer details and management
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Edit Profile
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Deactivate
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Basic organizer information and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Email</span>
                  </div>
                  <p className="font-medium">{organizer.email}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Joined</span>
                  </div>
                  <p className="font-medium">{formatDate(organizer.createdAt)}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Last Login</span>
                  </div>
                  <p className="font-medium">
                    {organizer.lastLoginAt ? formatDate(organizer.lastLoginAt) : 'Never'}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Settings className="h-4 w-4" />
                    <span>Status</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge()}
                    {getRoleBadge()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="mr-2 h-5 w-5" />
                Event Assignments
              </CardTitle>
              <CardDescription>
                Events assigned to this organizer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {organizer.eventAssignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No event assignments</p>
                  <p className="text-sm">This organizer hasn&apos;t been assigned to any events yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {organizer.eventAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <h4 className="font-medium">{assignment.event.name}</h4>
                        {assignment.event.description && (
                          <p className="text-sm text-muted-foreground">{assignment.event.description}</p>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                          <span>Start: {formatDate(assignment.event.startDate)}</span>
                          <span>End: {formatDate(assignment.event.endDate)}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={assignment.event.status === 'active' ? 'default' : 'secondary'}>
                          {assignment.event.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Assigned {formatDate(assignment.assignedAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="mr-2 h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest actions performed by this organizer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {organizer.activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-sm">This organizer hasn&apos;t performed any actions yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {organizer.activities.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">{activity.details}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
              <CardDescription>
                Key metrics for this organizer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Assignments</span>
                <span className="font-medium">{organizer.statistics.totalAssignments}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Events</span>
                <span className="font-medium">{organizer.statistics.activeEvents}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Recent Activities</span>
                <span className="font-medium">{organizer.statistics.recentActivityCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common management tasks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <MapPin className="mr-2 h-4 w-4" />
                Manage Assignments
              </Button>
              <Separator />
              <Button variant="destructive" className="w-full justify-start">
                <Trash2 className="mr-2 h-4 w-4" />
                Deactivate Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
