'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Search, Edit, Trash2, Users, Clock, MapPin, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { EventForm } from './EventForm';
import { EventDetails } from './EventDetails';
import { DeleteEventDialog } from './DeleteEventDialog';
import { EventWithDetails } from '@/lib/types/event';

interface EventManagementProps {
  className?: string;
}

export function EventManagement({ className }: EventManagementProps) {
  // const router = useRouter();
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'startDate' | 'endDate' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);

  const limit = 10;

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { isActive: statusFilter === 'active' ? 'true' : 'false' }),
      });

      const response = await fetch(`/api/admin/events?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      } else {
        throw new Error(data.error || 'Failed to fetch events');
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, sortBy, sortOrder, searchTerm, statusFilter]);

  // Handle event creation
  const handleCreateEvent = async (eventData: Record<string, unknown>) => {
    try {
      console.log('EventManagement: Creating event with data:', eventData);
      
      const response = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Event created successfully');
        setIsCreateDialogOpen(false);
        fetchEvents(); // Refresh the list
      } else {
        // Log detailed error information
        console.error('Event creation failed:', {
          status: response.status,
          data,
          eventData
        });
        
        // Show detailed error message
        const errorMessage = data.details 
          ? `Validation failed: ${data.details.map((d: { message: string }) => d.message).join(', ')}`
          : data.error || 'Failed to create event';
        
        throw new Error(errorMessage);
      }
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to create event');
    }
  };

  // Handle event update
  const handleUpdateEvent = async (eventData: Record<string, unknown>) => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`/api/admin/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Event updated successfully');
        setIsEditDialogOpen(false);
        setSelectedEvent(null);
        fetchEvents(); // Refresh the list
      } else {
        throw new Error(data.error || 'Failed to update event');
      }
    } catch (err) {
      console.error('Error updating event:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const response = await fetch(`/api/admin/events/${selectedEvent.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Event deleted successfully');
        setIsDeleteDialogOpen(false);
        setSelectedEvent(null);
        fetchEvents(); // Refresh the list
      } else {
        throw new Error(data.error || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  // Handle search and filters
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page
  };

  const handleStatusFilter = (value: 'all' | 'active' | 'inactive') => {
    setStatusFilter(value);
    setCurrentPage(1); // Reset to first page
  };


  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Open dialogs
  const openEditDialog = (event: EventWithDetails) => {
    setSelectedEvent(event);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (event: EventWithDetails) => {
    setSelectedEvent(event);
    setIsDeleteDialogOpen(true);
  };

  const openDetailsDialog = (event: EventWithDetails) => {
    setSelectedEvent(event);
    setIsDetailsDialogOpen(true);
  };

  // Format date for display
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge variant
  const getStatusBadgeVariant = (isActive: boolean) => {
    return isActive ? 'default' : 'secondary';
  };

  // Fetch events when dependencies change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  if (loading && events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Events...</CardTitle>
          <CardDescription>Please wait while we load the events.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Events</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchEvents} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      {/* Header with Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                Manage your events and sessions ({totalCount} total)
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              </DialogTrigger>
              <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden max-w-2xl sm:max-h-[calc(100dvh-2rem)]">
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                  <DialogDescription>
                    Create a new event with sessions and organizer assignments.
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
                  <EventForm
                    onSubmit={handleCreateEvent}
                    onCancel={() => setIsCreateDialogOpen(false)}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-') as [typeof sortBy, typeof sortOrder];
              setSortBy(field);
              setSortOrder(order);
            }}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                <SelectItem value="startDate-asc">Start Date (Earliest)</SelectItem>
                <SelectItem value="startDate-desc">Start Date (Latest)</SelectItem>
                <SelectItem value="endDate-asc">End Date (Earliest)</SelectItem>
                <SelectItem value="endDate-desc">End Date (Latest)</SelectItem>
                <SelectItem value="createdAt-asc">Created (Oldest)</SelectItem>
                <SelectItem value="createdAt-desc">Created (Newest)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events List */}
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'Get started by creating your first event.'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {event.name}
                          </h3>
                          <Badge variant={getStatusBadgeVariant(event.isActive)}>
                            {event.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        {event.description && (
                          <p className="text-gray-600 mb-3">{event.description}</p>
                        )}
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {formatDate(event.startDate)} - {formatDate(event.endDate)}
                            </span>
                          </div>
                          
                          {event.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{event.location}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{event._count.sessions} sessions</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{event._count.organizerAssignments} organizers</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetailsDialog(event)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(event)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteDialog(event)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalCount)} of {totalCount} events
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Event Dialog */}
      {selectedEvent && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>
                Update the event details and settings.
              </DialogDescription>
            </DialogHeader>
            <EventForm
              event={selectedEvent}
              onSubmit={handleUpdateEvent}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedEvent(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Event Details Dialog */}
      {selectedEvent && (
        <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Event Details</DialogTitle>
              <DialogDescription>
                View detailed information about the event.
              </DialogDescription>
            </DialogHeader>
            <EventDetails
              event={selectedEvent}
              onClose={() => {
                setIsDetailsDialogOpen(false);
                setSelectedEvent(null);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Event Dialog */}
      {selectedEvent && (
        <DeleteEventDialog
          event={selectedEvent}
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          onConfirm={handleDeleteEvent}
          onCancel={() => {
            setIsDeleteDialogOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
