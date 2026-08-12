'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuSeparator,
//   DropdownMenuTrigger,
// } from '@/components/ui/dropdown-menu';
import {
  Mail,
  Calendar,
  Clock,
  User,
  UserCheck,
  UserX,
  Activity,
  Eye,
  Shield,
  ShieldCheck,
  Settings,
  Edit
} from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { type Organizer } from '@/hooks/use-organizers';
import { OrganizerActions } from './OrganizerActions';
// import Link from 'next/link';

// Card variants using CVA
const organizerCardVariants = cva(
  "rounded-lg border bg-white dark:bg-gray-800 shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer",
  {
    variants: {
      status: {
        active: "border-green-200 dark:border-green-900/50 bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-green-900/30 dark:via-gray-800 dark:to-emerald-900/30",
        inactive: "border-red-200 dark:border-red-900/50 bg-gradient-to-br from-red-50 via-white to-rose-50 dark:from-red-900/30 dark:via-gray-800 dark:to-rose-900/30",
        pending: "border-yellow-200 dark:border-yellow-900/50 bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:from-yellow-900/30 dark:via-gray-800 dark:to-amber-900/30",
        neverLoggedIn: "border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50 via-white to-slate-50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-700",
      },
      size: {
        default: "w-full",
        compact: "w-full max-w-sm",
      }
    },
    defaultVariants: {
      status: "active",
      size: "default",
    },
  }
);

const statusIconVariants = cva(
  "flex h-8 w-8 items-center justify-center rounded-full",
  {
    variants: {
      status: {
        active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
        inactive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
        pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
        neverLoggedIn: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      }
    },
    defaultVariants: {
      status: "active",
    },
  }
);

export interface OrganizerCardProps extends VariantProps<typeof organizerCardVariants> {
  organizer: Organizer;
  onEdit?: (organizer: Organizer) => void;
  onDeactivate?: (organizer: Organizer) => void;
  onResendInvitation?: (organizer: Organizer) => Promise<string>;
  onViewDetails?: (organizer: Organizer) => void;
  showAssignments?: boolean;
  assignmentCount?: number;
  className?: string;
}

export function OrganizerCard({
  organizer,
  onEdit,
  onDeactivate,
  onResendInvitation,
  onViewDetails,
  showAssignments = false,
  assignmentCount = 0,
  status,
  size,
  className,
}: OrganizerCardProps) {
  // Determine status based on organizer data
  const getOrganizerStatus = (): 'active' | 'inactive' | 'pending' | 'neverLoggedIn' => {
    if (!organizer.isActive) return 'inactive';
    if (!organizer.lastLoginAt) return 'neverLoggedIn';
    
    const lastLogin = new Date(organizer.lastLoginAt);
    const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceLogin <= 7) return 'active';
    if (daysSinceLogin <= 30) return 'pending';
    return 'inactive';
  };

  const organizerStatus = status || getOrganizerStatus();

  const getStatusIcon = () => {
    switch (organizerStatus) {
      case 'active':
        return <UserCheck className="h-4 w-4" />;
      case 'inactive':
        return <UserX className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'neverLoggedIn':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (organizerStatus) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'pending':
        return 'Recently Active';
      case 'neverLoggedIn':
        return 'Never Logged In';
      default:
        return 'Unknown';
    }
  };

  const getRoleBadge = () => {
    return organizer.role === 'admin' ? (
      <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        <Shield className="mr-1 h-3 w-3" />
        Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Organizer
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatLastLogin = () => {
    if (!organizer.lastLoginAt) return 'Never';
    
    const lastLogin = new Date(organizer.lastLoginAt);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return formatDate(organizer.lastLoginAt);
  };

  return (
    <Card 
      className={cn(organizerCardVariants({ status: organizerStatus, size }), className)}
      onClick={() => onViewDetails?.(organizer)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(statusIconVariants({ status: organizerStatus }))}>
              {getStatusIcon()}
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg leading-none text-gray-900 dark:text-gray-100">{organizer.fullName}</h3>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground dark:text-gray-400">
                <Mail className="h-3 w-3" />
                <span className="truncate">{organizer.email}</span>
              </div>
            </div>
          </div>
          <OrganizerActions
            organizer={organizer}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
            onResendInvitation={onResendInvitation}
            onViewDetails={onViewDetails}
            size="sm"
            variant="ghost"
          />
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Status and Role */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge 
                variant={organizerStatus === 'active' ? 'default' : 'secondary'}
                className={
                  organizerStatus === 'active' 
                    ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                    : organizerStatus === 'inactive'
                    ? 'bg-red-100 text-red-800 hover:bg-red-100'
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                }
              >
                {getStatusText()}
              </Badge>
              {getRoleBadge()}
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-between text-sm text-muted-foreground dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Joined {formatDate(organizer.createdAt)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Activity className="h-3 w-3" />
                <span>Last login: {formatLastLogin()}</span>
              </div>
            </div>
          </div>

          {/* Assignments */}
          {showAssignments && (
            <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
              <div className="flex items-center space-x-1 text-sm text-muted-foreground dark:text-gray-400">
                <Settings className="h-3 w-3" />
                <span>Event Assignments</span>
              </div>
              <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">
                {assignmentCount} events
              </Badge>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(organizer);
                window.location.href = `/admin/organizers/${organizer.id}`;
              }}
            >
              <Eye className="mr-1 h-3 w-3" />
              View
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(organizer);
              }}
            >
              <Edit className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
