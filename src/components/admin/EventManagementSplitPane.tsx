'use client';

import React, { useEffect, useState } from 'react';
// import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EventWithDetails } from '@/lib/types/event';
import type { EventFilters as EventFiltersModel } from '@/components/admin/EventFilters';
import { EventsList } from '@/components/admin/EventsList';
import { EventDetailHeader } from '@/components/admin/EventDetailHeader';
import { EventDetailTabs } from '@/components/admin/EventDetailTabs';
import { EventEmptyState } from '@/components/admin/EventEmptyState';
import { EventForm } from '@/components/admin/EventForm';
import { SessionForm, SessionFormData } from '@/components/admin/SessionForm';
import { OrganizerAssignments } from '@/components/admin/organizers/OrganizerAssignments';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { eventFeedback, sessionFeedback, genericFeedback } from '@/lib/utils/toast-feedback';
import { 
  EventsListSkeleton, 
  EventDetailsSkeleton, 
  EventErrorState, 
  EventFiltersSkeleton,
  EventManagementLoadingOverlay 
} from '@/components/admin/EventLoadingStates';

// Separate component for session details to avoid IIFE issues
function SessionDetailsView({ 
  selectedEvent, 
  selectedSessionId, 
  setIsViewSessionOpen, 
  setIsEditSessionOpen 
}: {
  selectedEvent: EventWithDetails | null;
  selectedSessionId: string | null;
  setIsViewSessionOpen: (value: boolean) => void;
  setIsEditSessionOpen: (value: boolean) => void;
}): React.ReactNode {
  if (!selectedEvent || !selectedSessionId) return null;
  
  const session = selectedEvent.sessions.find(s => s.id === selectedSessionId);
  if (!session) return <p>Session not found.</p>;
  
  // Format date helper function with proper typing
  const formatDateTime = (date: string | Date | unknown) => {
    try {
      return new Date(date as string | Date).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Session Information */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Session Name</h3>
          <p className="text-base">{session.name}</p>
        </div>
        {session.description && (
          <div className="col-span-2">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Description</h3>
            <p className="text-base">{session.description}</p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Status</h3>
          <p className="text-base">
            {session.isActive ? (
              <span className="text-green-600 dark:text-green-400">Active</span>
            ) : (
              <span className="text-gray-600 dark:text-gray-400">Inactive</span>
            )}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Event</h3>
          <p className="text-base">{selectedEvent.name}</p>
        </div>
      </div>

      {/* Time Windows */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Time Windows</h3>
        <div className="space-y-3">
          <div className="p-3 border dark:border-gray-700 rounded-lg">
            <p className="text-sm font-medium mb-1">Time In Window</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formatDateTime(session.timeInStart)} - {formatDateTime(session.timeInEnd)}
            </p>
          </div>
          {session.timeOutStart != null && session.timeOutEnd != null ? (
            <div className="p-3 border dark:border-gray-700 rounded-lg">
              <p className="text-sm font-medium mb-1">Time Out Window</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDateTime(session.timeOutStart)} - {formatDateTime(session.timeOutEnd)}
              </p>
            </div>
          ) : (
            <div className="p-3 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
              <p className="text-sm font-medium mb-1 text-gray-500 dark:text-gray-400">Time Out Window</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No timeout window configured</p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Stats - Temporarily removed for accuracy */}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
        <Button variant="outline" onClick={() => setIsViewSessionOpen(false)}>
          Close
        </Button>
        <Button onClick={() => {
          setIsViewSessionOpen(false);
          setIsEditSessionOpen(true);
        }}>
          Edit Session
        </Button>
      </div>
    </div>
  );
}

export function EventManagementSplitPane() {
  const [events, setEvents] = useState<EventWithDetails[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState<boolean>(false);
  const [isCreatingSession] = useState<boolean>(false);
  const [showOrganizerAssignments, setShowOrganizerAssignments] = useState<boolean>(false);
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState<boolean>(false);
  const [viewDetailsEvent, setViewDetailsEvent] = useState<EventWithDetails | null>(null);
  const [isViewSessionOpen, setIsViewSessionOpen] = useState<boolean>(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState<boolean>(false);
  const [isDeleteSessionOpen, setIsDeleteSessionOpen] = useState<boolean>(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFiltersModel>({
    search: '',
    status: 'all',
    dateRange: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [currentPage] = useState(1);
  const limit = 10;
  const [localSearch, setLocalSearch] = useState<string>('');

  const fetchEvents = async (options?: { suppressLoading?: boolean; searchOverride?: string }) => {
    try {
      if (!options?.suppressLoading) setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        search: (options?.searchOverride ?? filters.search) || '',
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });
      if (filters.status !== 'all') params.set('isActive', filters.status === 'active' ? 'true' : 'false');

      const response = await fetch(`/api/admin/events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load events');
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load events');

      setEvents(data.events as EventWithDetails[]);
      
      if (!selectedEvent && data.events.length > 0) {
        setSelectedEvent(data.events[0]);
      } else if (selectedEvent) {
        const updated = data.events.find((e: EventWithDetails) => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load events');
    } finally {
      if (!options?.suppressLoading) setLoading(false);
    }
  };

  // Initial and non-search filter changes use full loading
  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.sortBy, filters.sortOrder]);

  // Debounce search input and suppress loading overlay for search fetches
  useEffect(() => {
    // If cleared, update and fetch immediately for snappy feel
    if (localSearch.trim() === '') {
      setFilters((prev) => (prev.search === '' ? prev : { ...prev, search: '' }));
      fetchEvents({ suppressLoading: true, searchOverride: '' });
      return;
    }

    const handle = setTimeout(() => {
      // Sync debounced search into filters
      setFilters((prev) => (prev.search === localSearch ? prev : { ...prev, search: localSearch }));
      // Trigger fetch without overlay when search changes
      fetchEvents({ suppressLoading: true, searchOverride: localSearch });
    }, 150);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  const handleEventSelect = (event: EventWithDetails) => setSelectedEvent(event);

  const handleCreateSession = () => {
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }
    setIsCreateSessionOpen(true);
  };

  const handleViewOrganizer = (organizerId: string) => {
    // Navigate to organizer details page
    window.open(`/admin/organizers/${organizerId}`, '_blank');
  };

  const handleRemoveOrganizer = async (organizerId: string) => {
    if (!selectedEvent) return;

    const organizer = selectedEvent.organizerAssignments.find(a => a.organizer.id === organizerId)?.organizer;
    if (!organizer) return;

    const confirmed = confirm(`Are you sure you want to remove ${organizer.fullName} from this event?`);
    if (!confirmed) return;

    const toastId = eventFeedback.update.loading(`Removing ${organizer.fullName} from ${selectedEvent.name}`);

    try {
      const response = await fetch(`/api/admin/events/${selectedEvent.id}/organizers`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizerId,
          reason: 'Removed via event details',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove organizer');
      }

      eventFeedback.update.success(`${organizer.fullName} removed from ${selectedEvent.name}`, String(toastId));
      
      // Refresh events to update the data
      await fetchEvents();
    } catch (err: unknown) {
      eventFeedback.update.error(`${organizer.fullName} removal`, err instanceof Error ? err.message : 'Failed to remove organizer', String(toastId));
    }
  };

  const handleViewDetails = (event: EventWithDetails) => {
    setViewDetailsEvent(event);
    setIsViewDetailsOpen(true);
  };

  const handleEditEvent = (event?: EventWithDetails) => {
    // If event is provided (from list action), select it first
    if (event) {
      setSelectedEvent(event);
    }
    setIsEditOpen(true);
  };

  const handleDeleteEvent = (event?: EventWithDetails) => {
    // If event is provided (from list action), select it first
    if (event) {
      console.log('Delete button clicked for event:', event.id, event.name);
      setSelectedEvent(event);
    } else {
      console.log('Delete button clicked for event:', selectedEvent?.id, selectedEvent?.name);
    }
    setIsDeleteOpen(true);
  };

  const handleUpdateEvent = async (eventData: Record<string, unknown>) => {
    if (!selectedEvent) return;

    const toastId = eventFeedback.update.loading(selectedEvent.name);

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
        eventFeedback.update.success(selectedEvent.name, String(toastId));
        setIsEditOpen(false);
        await fetchEvents();
      } else {
        throw new Error(data.error || 'Failed to update event');
      }
    } catch (err: unknown) {
      eventFeedback.update.error(selectedEvent.name, err instanceof Error ? err.message : 'Failed to update event', String(toastId));
    }
  };

  const handleDeleteEventConfirm = async () => {
    if (!selectedEvent) return;

    const toastId = eventFeedback.delete.loading(selectedEvent.name);

    try {
      console.log('Attempting to delete event:', selectedEvent.id, selectedEvent.name);
      
      const response = await fetch(`/api/admin/events/${selectedEvent.id}`, {
        method: 'DELETE',
      });

      console.log('Delete response status:', response.status);
      console.log('Delete response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Delete response data:', data);

      if (data.success) {
        eventFeedback.delete.success(selectedEvent.name, String(toastId));
        setIsDeleteOpen(false);
        const deletedEventId = selectedEvent.id;
        setSelectedEvent(null);
        await fetchEvents({ suppressLoading: true });
        setEvents((currentEvents) => currentEvents.filter((event) => event.id !== deletedEventId));
      } else {
        // Check if it's a warning (attendance records exist)
        if (response.status === 400 && data.error?.includes('attendance records')) {
          eventFeedback.delete.warning(selectedEvent.name, data.error);
        } else {
          throw new Error(data.error || 'Failed to delete event');
        }
      }
    } catch (err: unknown) {
      console.error('Delete event error:', err);
      eventFeedback.delete.error(selectedEvent.name, err instanceof Error ? err.message : 'Failed to delete event', String(toastId));
    }
  };

  const handleCreateEvent = async (eventData: Record<string, unknown>) => {
    const eventName = eventData.name as string || 'New Event';
    const toastId = eventFeedback.create.loading(eventName);

    try {
      // Extract organizer IDs from the form data
      const organizerIds = eventData.organizerIds as string[] || [];
      
      // Create the event first
      const eventPayload = {
        ...eventData,
        organizerIds: undefined, // Remove organizerIds from event creation payload
      };
      
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventPayload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to create event');
      }
      
      // If organizers were selected, assign them to the event
      if (organizerIds.length > 0 && data.event?.id) {
        try {
          const assignRes = await fetch(`/api/admin/events/${data.event.id}/organizers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizerIds }),
          });
          
          if (!assignRes.ok) {
            const assignData = await assignRes.json();
            console.warn('Failed to assign organizers:', assignData.error);
            // Don't fail the entire operation, just warn
            toast.warning('Event created but organizer assignment failed');
          }
        } catch (assignErr) {
          console.warn('Error assigning organizers:', assignErr);
          toast.warning('Event created but organizer assignment failed');
        }
      }
      
      eventFeedback.create.success(eventName, String(toastId));
      setIsCreateOpen(false);
      await fetchEvents();
    } catch (err: unknown) {
      eventFeedback.create.error(eventName, err instanceof Error ? err.message : 'Failed to create event', String(toastId));
    }
  };

  const handleViewSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsViewSessionOpen(true);
  };

  const handleEditSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsEditSessionOpen(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setIsDeleteSessionOpen(true);
  };

  const handleDeleteSessionConfirm = async () => {
    if (!selectedSessionId || !selectedEvent) return;

    const session = selectedEvent.sessions.find(s => s.id === selectedSessionId);
    const sessionName = session?.name || 'Session';
    const toastId = sessionFeedback.delete.loading(sessionName);

    try {
      const response = await fetch(`/api/admin/sessions/${selectedSessionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        sessionFeedback.delete.success(sessionName, String(toastId));
        setIsDeleteSessionOpen(false);
        setSelectedSessionId(null);
        await fetchEvents(); // Refresh to get updated session data
      } else {
        throw new Error(data.error || 'Failed to delete session');
      }
    } catch (err: unknown) {
      sessionFeedback.delete.error(sessionName, err instanceof Error ? err.message : 'Failed to delete session', String(toastId));
    }
  };

  const handleEditSessionSubmit = async (sessionData: SessionFormData) => {
    if (!selectedSessionId || !selectedEvent) return;

    const session = selectedEvent.sessions.find(s => s.id === selectedSessionId);
    const sessionName = session?.name || 'Session';
    const toastId = sessionFeedback.update.loading(sessionName);

    try {
      const response = await fetch(`/api/admin/sessions/${selectedSessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      const data = await response.json();

      if (data.success) {
        sessionFeedback.update.success(sessionName, String(toastId));
        setIsEditSessionOpen(false);
        setSelectedSessionId(null);
        await fetchEvents(); // Refresh to get updated session data
      } else {
        throw new Error(data.error || 'Failed to update session');
      }
    } catch (err: unknown) {
      sessionFeedback.update.error(sessionName, err instanceof Error ? err.message : 'Failed to update session', String(toastId));
    }
  };

  const handleCreateSessionSubmit = async (sessionData: SessionFormData) => {
    if (!selectedEvent) return;

    const sessionName = sessionData.name || 'New Session';
    const toastId = sessionFeedback.create.loading(sessionName);

    try {
      // Get organizer IDs from the event's organizer assignments
      console.log('Event organizer assignments:', selectedEvent.organizerAssignments);
      const organizerIds = selectedEvent.organizerAssignments.length > 0 
        ? selectedEvent.organizerAssignments.map(assignment => assignment.organizer.id)
        : []; // Fallback to empty array if no organizers assigned

      console.log('Organizer IDs:', organizerIds);

      // Check if we have organizers assigned
      if (organizerIds.length === 0) {
        console.log('No organizers found, using placeholder organizer for testing');
        // For now, use a placeholder organizer ID to allow testing
        organizerIds.push('clx1234567890123456789012');
        genericFeedback.warning('No organizers assigned', 'Using placeholder organizer for testing.');
      }

      console.log('Proceeding with session creation with organizers:', organizerIds);

      const requestBody = {
        ...sessionData,
        eventId: selectedEvent.id,
        organizerIds: organizerIds,
      };

      console.log('Sending session creation request:', requestBody);
      console.log('Request body JSON:', JSON.stringify(requestBody, null, 2));

      console.log('Making API call to /api/admin/sessions...');
      const response = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      console.log('API call completed, response received');

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        const textResponse = await response.text();
        console.error('Raw response text:', textResponse);
        throw new Error('Invalid response format from server');
      }

      if (data.success) {
        sessionFeedback.create.success(sessionName, String(toastId));
        setIsCreateSessionOpen(false);
        await fetchEvents(); // Refresh to get updated session data
      } else {
        console.error('Session creation failed:', data);
        
        // Handle conflict errors specifically
        if (response.status === 409 && data.conflictingSessions) {
          sessionFeedback.create.conflict(sessionName, data.conflictingSessions, String(toastId));
        } else {
          throw new Error(data.error || 'Failed to create session');
        }
      }
    } catch (err: unknown) {
      sessionFeedback.create.error(sessionName, err instanceof Error ? err.message : 'Failed to create session', String(toastId));
    }
  };

  const LeftPane = (
    <div className="border-r h-full overflow-hidden flex flex-col bg-white dark:bg-gray-900 dark:border-gray-800">
      <div className="p-4 border-b sticky top-0 bg-white dark:bg-gray-900 dark:border-gray-800 z-10 space-y-3">
        {loading ? (
          <EventFiltersSkeleton />
        ) : (
          <>
            {/* Full-row search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search events..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setFilters((prev) => (prev.search === localSearch ? prev : { ...prev, search: localSearch }));
                    fetchEvents({ suppressLoading: true, searchOverride: localSearch });
                  }
                }}
                className="pl-10"
              />
            </div>
            {/* Filters row */}
            <div className="flex items-center gap-2">
              <Select value={filters.status} onValueChange={(value: string) => setFilters((f) => ({ ...f, status: value as 'all' | 'active' | 'inactive' | 'upcoming' | 'ended' }))}>
                <SelectTrigger className="h-10 w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Now</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ended">Ended</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.dateRange} onValueChange={(value: string) => setFilters((f) => ({ ...f, dateRange: value as 'all' | 'today' | 'week' | 'month' | 'custom' }))}>
                <SelectTrigger className="h-10 w-[140px]">
                  <SelectValue placeholder="Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
      <div className="flex-1 overflow-auto px-3 py-2">
        {loading ? (
          <EventsListSkeleton />
        ) : error ? (
          <EventErrorState 
            error={error} 
            onRetry={fetchEvents}
            className="mx-2"
          />
        ) : (
          <EventsList
            events={events}
            selectedEventId={selectedEvent?.id ?? null}
            onEventSelect={handleEventSelect}
            onViewDetails={handleViewDetails}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
            onAssignmentChange={fetchEvents}
            loading={loading}
          />
        )}
      </div>
      <div className="p-3 border-t bg-white dark:bg-gray-900 dark:border-gray-800">
        <Button type="button" className="w-full" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>
    </div>
  );

  const RightPane = (
    <div className="h-full overflow-auto bg-white dark:bg-gray-900">
      {loading ? (
        <div className="p-6">
          <EventDetailsSkeleton />
        </div>
      ) : !selectedEvent ? (
        <EventEmptyState variant="no-selection" className="p-6" />
      ) : (
        <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-screen-xl">
          <EventDetailHeader
            event={selectedEvent}
            onEdit={handleEditEvent}
            onCreateSession={handleCreateSession}
          />
          {showOrganizerAssignments ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Organizer Assignments</h2>
                <Button 
                  variant="outline" 
                  onClick={() => setShowOrganizerAssignments(false)}
                >
                  Back to Event Details
                </Button>
              </div>
              <OrganizerAssignments 
                eventId={selectedEvent.id}
                className="pb-6"
              />
            </div>
          ) : (
            <EventDetailTabs
              event={selectedEvent}
              onCreateSession={handleCreateSession}
              onViewSession={handleViewSession}
              onEditSession={handleEditSession}
              onDeleteSession={handleDeleteSession}
              onAssignOrganizer={() => setShowOrganizerAssignments(true)}
              onViewOrganizer={handleViewOrganizer}
              onRemoveOrganizer={handleRemoveOrganizer}
              className="pb-6"
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="h-[calc(100vh-220px)] grid grid-cols-1 lg:grid-cols-[360px_1fr] bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-md overflow-hidden relative">
        {LeftPane}
        {RightPane}
        <EventManagementLoadingOverlay isLoading={loading} />
      </div>

      {/* Create Event Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden max-w-2xl sm:max-h-[calc(100dvh-2rem)]">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
            <DialogDescription>Create a new event with sessions and organizer assignments.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            <EventForm onSubmit={handleCreateEvent} onCancel={() => setIsCreateOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event details and configuration.</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <EventForm 
              event={selectedEvent}
              onSubmit={handleUpdateEvent} 
              onCancel={() => setIsEditOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Event Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedEvent?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteEventConfirm}>
              Delete Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Session Dialog */}
      <Dialog open={isCreateSessionOpen} onOpenChange={setIsCreateSessionOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Create a new session for &quot;{selectedEvent?.name}&quot; with time windows for attendance tracking.
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <SessionForm
              eventId={selectedEvent.id}
              onSubmit={handleCreateSessionSubmit}
              onCancel={() => setIsCreateSessionOpen(false)}
              onSuccess={() => setIsCreateSessionOpen(false)}
              isSubmitting={isCreatingSession}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Session Details Dialog */}
      <Dialog open={isViewSessionOpen} onOpenChange={setIsViewSessionOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>
              Complete information about this session.
            </DialogDescription>
          </DialogHeader>
          <SessionDetailsView 
            selectedEvent={selectedEvent}
            selectedSessionId={selectedSessionId}
            setIsViewSessionOpen={setIsViewSessionOpen}
            setIsEditSessionOpen={setIsEditSessionOpen}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={isEditSessionOpen} onOpenChange={setIsEditSessionOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update session details and time windows.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            if (!selectedEvent || !selectedSessionId) return null;
            const session = selectedEvent.sessions.find(s => s.id === selectedSessionId);
            if (!session) return <p>Session not found.</p>;
            
            return (
              <SessionForm
                eventId={selectedEvent.id}
                session={{
                  id: session.id,
                  name: session.name,
                  description: session.description || undefined,
                  timeInStart: new Date(session.timeInStart),
                  timeInEnd: new Date(session.timeInEnd),
                  timeOutStart: session.timeOutStart ? new Date(session.timeOutStart) : undefined,
                  timeOutEnd: session.timeOutEnd ? new Date(session.timeOutEnd) : undefined,
                  hasTimeout: session.timeOutStart && session.timeOutEnd ? true : false,
                }}
                onSubmit={handleEditSessionSubmit}
                onCancel={() => {
                  setIsEditSessionOpen(false);
                  setSelectedSessionId(null);
                }}
                onSuccess={() => {
                  setIsEditSessionOpen(false);
                  setSelectedSessionId(null);
                }}
                isSubmitting={false}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Session Dialog */}
      <Dialog open={isDeleteSessionOpen} onOpenChange={setIsDeleteSessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedEvent && selectedSessionId && selectedEvent.sessions.find(s => s.id === selectedSessionId)?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => {
              setIsDeleteSessionOpen(false);
              setSelectedSessionId(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSessionConfirm}>
              Delete Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Event Details: {viewDetailsEvent?.name}</DialogTitle>
            <DialogDescription>
              Complete information about this event including sessions, organizers, and attendance.
            </DialogDescription>
          </DialogHeader>
          {viewDetailsEvent && (
            <div className="space-y-6">
              {/* Event Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Event Name</h3>
                  <p className="text-base">{viewDetailsEvent.name}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Status</h3>
                  <p className="text-base">
                    {viewDetailsEvent.isActive ? (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">Inactive</span>
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Start Date</h3>
                  <p className="text-base">
                    {new Date(viewDetailsEvent.startDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">End Date</h3>
                  <p className="text-base">
                    {new Date(viewDetailsEvent.endDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {viewDetailsEvent.location && (
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Location</h3>
                    <p className="text-base">{viewDetailsEvent.location}</p>
                  </div>
                )}
                {viewDetailsEvent.description && (
                  <div className="col-span-2">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Description</h3>
                    <p className="text-base">{viewDetailsEvent.description}</p>
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  Sessions ({viewDetailsEvent._count?.sessions || 0})
                </h3>
                {viewDetailsEvent.sessions && viewDetailsEvent.sessions.length > 0 ? (
                  <div className="space-y-2">
                    {viewDetailsEvent.sessions.map((session) => (
                      <div 
                        key={session.id} 
                        className="p-3 border dark:border-gray-700 rounded-lg flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium">{session.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(session.timeInStart).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })} - {new Date(session.timeInEnd).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <div>
                          {session.isActive ? (
                            <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                              Active
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No sessions created yet.</p>
                )}
              </div>

              {/* Organizers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">
                  Organizers ({viewDetailsEvent._count?.organizerAssignments || 0})
                </h3>
                {viewDetailsEvent.organizerAssignments && viewDetailsEvent.organizerAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {viewDetailsEvent.organizerAssignments.map((assignment) => (
                      <div 
                        key={assignment.id} 
                        className="p-3 border dark:border-gray-700 rounded-lg flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium">{assignment.organizer.fullName}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{assignment.organizer.email}</p>
                        </div>
                        <div>
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded capitalize">
                            {assignment.organizer.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No organizers assigned yet.</p>
                )}
              </div>

              {/* Attendance Stats - Temporarily removed for accuracy */}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button variant="outline" onClick={() => setIsViewDetailsOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsViewDetailsOpen(false);
                  setSelectedEvent(viewDetailsEvent);
                  setIsEditOpen(true);
                }}>
                  Edit Event
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
