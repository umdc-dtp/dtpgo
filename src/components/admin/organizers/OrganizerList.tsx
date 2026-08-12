'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  Mail,
  RefreshCw,
  Grid3X3,
  List,
  MapPin
} from 'lucide-react';
import { useOrganizers, type Organizer } from '@/hooks/use-organizers';
import { OrganizerCard } from './OrganizerCard';
import { OrganizerActions } from './OrganizerActions';
import { BulkAssignmentModal } from './BulkAssignmentModal';
import { toast } from 'sonner';
// import Link from 'next/link';

interface OrganizerListProps {
  searchQuery?: string;
}

export function OrganizerList({ searchQuery = '' }: OrganizerListProps) {
  const [search, setSearch] = useState(searchQuery);
  const [roleFilter, setRoleFilter] = useState<'all' | 'organizer' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [showBulkAssignmentModal, setShowBulkAssignmentModal] = useState(false);
  const limit = 10;

  const { 
    organizers, 
    loading, 
    error, 
    total, 
    refetch, 
    hasNextPage, 
    hasPreviousPage 
  } = useOrganizers({
    search,
    role: roleFilter,
    status: statusFilter,
    page,
    limit,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page when searching
  };

  const handleFilterChange = (filterType: 'role' | 'status', value: string) => {
    if (filterType === 'role') {
      setRoleFilter(value as 'all' | 'organizer' | 'admin');
    } else {
      setStatusFilter(value as 'all' | 'active' | 'inactive');
    }
    setPage(1); // Reset to first page when filtering
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const createInvitationLink = async (organizer: Organizer) => {
    const response = await fetch(`/api/admin/organizers/${organizer.id}/resend-invitation`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create invitation link');
    }

    const data = await response.json();
    if (typeof data.inviteLink !== 'string' || data.inviteLink.length === 0) {
      throw new Error('Invitation link was not returned');
    }
    refetch();
    return data.inviteLink;
  };

  const getStatusBadge = (organizer: Organizer) => {
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

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge variant="default">Admin</Badge>
    ) : (
      <Badge variant="secondary">Organizer</Badge>
    );
  };

  const getInvitationBadge = (organizer: Organizer) => {
    // Derive invitation status from available fields
    if (!organizer.invitedAt) {
      return <Badge variant="outline">Not Invited</Badge>;
    }
    if (organizer.lastLoginAt) {
      return <Badge variant="default">Accepted</Badge>;
    }
    return <Badge variant="secondary">Sent</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Failed to load organizers</p>
            <Button onClick={refetch} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Organizers</CardTitle>
            <CardDescription>
              Manage and view all organizers in the system
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowBulkAssignmentModal(true)} 
              variant="outline" 
              size="sm"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Bulk Assign
            </Button>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizers by name or email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={(value) => handleFilterChange('role', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="organizer">Organizer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => handleFilterChange('status', value)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="rounded-r-none border-r"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="rounded-l-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {organizers.length} of {total} organizers
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserCheck className="h-4 w-4" />
            <span>{organizers.filter(o => o.isActive).length} active</span>
            <UserX className="h-4 w-4 ml-2" />
            <span>{organizers.filter(o => !o.isActive).length} inactive</span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading organizers...</p>
          </div>
        ) : organizers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No organizers found</p>
            <p className="text-sm text-muted-foreground">
              {search || roleFilter !== 'all' || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by inviting your first organizer'
              }
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'table' ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organizer</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invitation</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizers.map((organizer) => (
                      <TableRow key={organizer.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{organizer.fullName}</div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {organizer.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(organizer.role)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(organizer)}
                        </TableCell>
                        <TableCell>
                          {getInvitationBadge(organizer)}
                        </TableCell>
                        <TableCell>
                          {organizer.lastLoginAt ? (
                            <div className="text-sm">
                              {formatDate(organizer.lastLoginAt)}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {formatDate(organizer.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <OrganizerActions
                            organizer={organizer}
                            onEdit={(org) => {
                              // Handle edit action
                              toast.info(`Edit organizer: ${org.fullName}`);
                            }}
                            onDeactivate={async (org) => {
                              // Handle deactivate action
                              try {
                                const response = await fetch(`/api/admin/organizers/${org.id}`, {
                                  method: 'DELETE',
                                });
                                if (response.ok) {
                                  toast.success(`${org.fullName} has been deactivated`);
                                  refetch();
                                } else {
                                  throw new Error('Failed to deactivate organizer');
                                }
                              } catch (_error) {
                                toast.error('Failed to deactivate organizer');
                              }
                            }}
                            onActivate={async (org) => {
                              // Handle activate action
                              try {
                                const response = await fetch(`/api/admin/organizers/${org.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ isActive: true }),
                                });
                                if (response.ok) {
                                  toast.success(`${org.fullName} has been activated`);
                                  refetch();
                                } else {
                                  throw new Error('Failed to activate organizer');
                                }
                              } catch (_error) {
                                toast.error('Failed to activate organizer');
                              }
                            }}
                            onResendInvitation={createInvitationLink}
                            onViewDetails={(org) => {
                              window.location.href = `/admin/organizers/${org.id}`;
                            }}
                            onManageAssignments={(_org) => {
                              setShowBulkAssignmentModal(true);
                            }}
                            onViewActivity={(org) => {
                              toast.info(`View activity for: ${org.fullName}`);
                            }}
                            size="sm"
                            variant="ghost"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {organizers.map((organizer) => (
                  <OrganizerCard
                    key={organizer.id}
                    organizer={organizer}
                    onViewDetails={(org) => {
                      // Navigate to organizer details
                      window.location.href = `/admin/organizers/${org.id}`;
                    }}
                    onEdit={(org) => {
                      // Handle edit action
                      toast.info(`Edit organizer: ${org.fullName}`);
                    }}
                    onDeactivate={(org) => {
                      // Handle deactivate action
                      toast.info(`Deactivate organizer: ${org.fullName}`);
                    }}
                    onResendInvitation={createInvitationLink}
                    showAssignments={true}
                    assignmentCount={0} // This would come from API in real implementation
                    size="compact"
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(total / limit)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={!hasPreviousPage || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={!hasNextPage || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      
      {/* Bulk Assignment Modal */}
      <BulkAssignmentModal
        isOpen={showBulkAssignmentModal}
        onClose={() => setShowBulkAssignmentModal(false)}
        onSuccess={() => {
          refetch(); // Refresh the organizer list after successful operations
        }}
      />
    </Card>
  );
}
