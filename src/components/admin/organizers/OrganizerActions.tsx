'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreHorizontal,
  Eye,
  Edit,
  RefreshCw,
  UserCheck,
  UserX,
  MapPin,
  Activity,
  Copy,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { type Organizer } from '@/hooks/use-organizers';
import Link from 'next/link';

interface OrganizerActionsProps {
  organizer: Organizer;
  onEdit?: (organizer: Organizer) => void;
  onDeactivate?: (organizer: Organizer) => void;
  onActivate?: (organizer: Organizer) => void;
  onResendInvitation?: (organizer: Organizer) => Promise<string>;
  onViewDetails?: (organizer: Organizer) => void;
  onManageAssignments?: (organizer: Organizer) => void;
  onViewActivity?: (organizer: Organizer) => void;
  onCopyEmail?: (organizer: Organizer) => void;
  onExportData?: (organizer: Organizer) => void;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'ghost' | 'outline' | 'default';
  showLabels?: boolean;
}

export function OrganizerActions({
  organizer,
  onEdit,
  onDeactivate,
  onActivate,
  onResendInvitation,
  onViewDetails,
  onManageAssignments,
  onViewActivity: _onViewActivity,
  onCopyEmail,
  onExportData,
  className,
  size = 'sm',
  variant = 'ghost',
  showLabels = false,
}: OrganizerActionsProps) {
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [showResendDialog, setShowResendDialog] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDeactivate = async () => {
    try {
      setIsLoading(true);
      await onDeactivate?.(organizer);
      setShowDeactivateDialog(false);
    } catch (error) {
      console.error('Error deactivating organizer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    try {
      setIsLoading(true);
      await onActivate?.(organizer);
      setShowActivateDialog(false);
    } catch (error) {
      console.error('Error activating organizer:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendInvitation = async () => {
    try {
      setIsLoading(true);
      if (!onResendInvitation) {
        throw new Error('Invitation link creation is unavailable')
      }
      const newInviteLink = await onResendInvitation(organizer);
      setInviteLink(newInviteLink);
      toast.success(`New invitation link created for ${organizer.fullName}`);
    } catch (error) {
      console.error('Error refreshing invitation link:', error);
      toast.error('Failed to create invitation link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(organizer.email);
    toast.success('Email address copied to clipboard');
    onCopyEmail?.(organizer);
  };

  const handleExportData = () => {
    // Create a simple data export
    const exportData = {
      organizer: {
        id: organizer.id,
        fullName: organizer.fullName,
        email: organizer.email,
        role: organizer.role,
        isActive: organizer.isActive,
        createdAt: organizer.createdAt,
        lastLoginAt: organizer.lastLoginAt,
      },
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organizer-${organizer.fullName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Organizer data exported successfully');
    onExportData?.(organizer);
  };

  const getStatusActions = () => {
    if (organizer.isActive) {
      return (
        <DropdownMenuItem
          onClick={() => setShowDeactivateDialog(true)}
          className="text-destructive focus:text-destructive"
        >
          <UserX className="mr-2 h-4 w-4" />
          {showLabels && 'Deactivate Account'}
          {!showLabels && 'Deactivate'}
        </DropdownMenuItem>
      );
    } else {
      return (
        <DropdownMenuItem
          onClick={() => setShowActivateDialog(true)}
          className="text-green-600 focus:text-green-600"
        >
          <UserCheck className="mr-2 h-4 w-4" />
          {showLabels && 'Activate Account'}
          {!showLabels && 'Activate'}
        </DropdownMenuItem>
      );
    }
  };

  const getLastLoginStatus = () => {
    if (!organizer.lastLoginAt) {
      return 'Never logged in';
    }
    
    const lastLogin = new Date(organizer.lastLoginAt);
    const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLogin === 0) {
      return 'Logged in today';
    } else if (daysSinceLogin === 1) {
      return 'Logged in yesterday';
    } else if (daysSinceLogin <= 7) {
      return `Last login ${daysSinceLogin} days ago`;
    } else {
      return `Last login ${daysSinceLogin} days ago`;
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={variant} 
            size={size} 
            className={className}
            disabled={isLoading}
          >
            <MoreHorizontal className="h-4 w-4" />
            {showLabels && <span className="ml-2">Actions</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* View Actions */}
          <DropdownMenuItem asChild>
            <Link href={`/admin/organizers/${organizer.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              {showLabels && 'View Details'}
              {!showLabels && 'View'}
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => onViewDetails?.(organizer)}>
            <Activity className="mr-2 h-4 w-4" />
            {showLabels && 'View Activity'}
            {!showLabels && 'Activity'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Edit Actions */}
          <DropdownMenuItem onClick={() => onEdit?.(organizer)}>
            <Edit className="mr-2 h-4 w-4" />
            {showLabels && 'Edit Profile'}
            {!showLabels && 'Edit'}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onManageAssignments?.(organizer)}>
            <MapPin className="mr-2 h-4 w-4" />
            {showLabels && 'Manage Assignments'}
            {!showLabels && 'Assignments'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Communication Actions */}
          <DropdownMenuItem onClick={handleCopyEmail}>
            <Copy className="mr-2 h-4 w-4" />
            {showLabels && 'Copy Email'}
            {!showLabels && 'Copy Email'}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowResendDialog(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {showLabels && 'Create New Invite Link'}
            {!showLabels && 'New Invite Link'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Data Actions */}
          <DropdownMenuItem onClick={handleExportData}>
            <Download className="mr-2 h-4 w-4" />
            {showLabels && 'Export Data'}
            {!showLabels && 'Export'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Status Actions */}
          {getStatusActions()}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Organizer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate <strong>{organizer.fullName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Prevent them from logging into the system</li>
                <li>Remove their access to assigned events</li>
                <li>Preserve their data and activity history</li>
              </ul>
              <br />
              You can reactivate them later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activate Confirmation Dialog */}
      <AlertDialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate Organizer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to activate <strong>{organizer.fullName}</strong>?
              <br />
              <br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Allow them to log into the system</li>
                <li>Restore their access to previously assigned events</li>
                <li>Enable them to manage attendance</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivate}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Activating...' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resend Invitation Confirmation Dialog */}
      <AlertDialog open={showResendDialog} onOpenChange={(open) => {
        setShowResendDialog(open);
        if (!open) setInviteLink('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Invitation Link</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
              {inviteLink ? (
                <>
                  <p className="mb-3">Copy and send this link to <strong>{organizer.fullName}</strong>.</p>
                  <div className="flex gap-2">
                    <input
                      value={inviteLink}
                      readOnly
                      aria-label="Organizer invitation link"
                      className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                    />
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteLink);
                          toast.success('Invitation link copied');
                        } catch {
                          toast.error('Could not copy automatically. Select and copy the visible link.');
                        }
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </>
              ) : (
                <>
              Create a new invitation link for <strong>{organizer.fullName}</strong>?
              <br />
              <br />
              Current status: <strong>{getLastLoginStatus()}</strong>
              <br />
              <br />
              Their previous link will stop working. Copy the new link after it is created.
                </>
              )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {inviteLink ? (
              <AlertDialogCancel>Close</AlertDialogCancel>
            ) : (
              <>
                <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                <Button type="button" onClick={handleResendInvitation} disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create New Link'}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
