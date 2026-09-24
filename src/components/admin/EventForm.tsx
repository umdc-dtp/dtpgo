'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { MultiSelect } from '@/components/ui/multi-select';
import { MapPin, Save, X, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { createEventSchema, type CreateEventInput } from '@/lib/validations/event';
import { EventWithDetails } from '@/lib/types/event';

// Form data type
type EventFormData = {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  isActive: boolean;
  organizerIds?: string[];
};

interface EventFormProps {
  event?: EventWithDetails;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
}

// Organizer type
interface Organizer {
  id: string;
  email: string;
  fullName: string;
  role: 'organizer' | 'admin';
  isActive: boolean;
}

export function EventForm({ event, onSubmit, onCancel }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableOrganizers, setAvailableOrganizers] = useState<Organizer[]>([]);
  const [loadingOrganizers, setLoadingOrganizers] = useState(false);
  const [organizerError, setOrganizerError] = useState<string | null>(null);
  const isEditing = !!event;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<EventFormData>({
    defaultValues: {
      name: event?.name || '',
      description: event?.description || undefined,
      startDate: event?.startDate ? new Date(event.startDate) : new Date(),
      endDate: event?.endDate ? new Date(event.endDate) : new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
      location: event?.location || undefined,
      isActive: event?.isActive ?? true,
      organizerIds: event?.organizerAssignments?.map(a => a.organizer.id) || [],
    },
  });

  // Fetch available organizers
  const fetchOrganizers = async () => {
    try {
      setLoadingOrganizers(true);
      setOrganizerError(null);
      
      const response = await fetch('/api/admin/organizers');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch organizers');
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch organizers');
      }
      
      // Filter only active organizers
      const activeOrganizers = data.organizers.filter((org: Organizer) => org.isActive);
      setAvailableOrganizers(activeOrganizers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organizers';
      setOrganizerError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoadingOrganizers(false);
    }
  };

  // Load organizers on mount
  useEffect(() => {
    fetchOrganizers();
  }, []);

  const watchedStartDate = watch('startDate');
  const watchedEndDate = watch('endDate');

  // Auto-adjust end date if it's before start date
  useEffect(() => {
    if (watchedStartDate && watchedEndDate) {
      if (watchedEndDate <= watchedStartDate) {
        // Set end date to 1 hour after start date
        const newEndDate = new Date(watchedStartDate.getTime() + 60 * 60 * 1000);
        setValue('endDate', newEndDate);
      }
    }
  }, [watchedStartDate, watchedEndDate, setValue]);

  const handleFormSubmit = handleSubmit(async (data: EventFormData) => {
    try {
      setIsSubmitting(true);
      
      // Convert Date objects to ISO strings for API submission
      const formData = {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
      };

      console.log('Submitting event form data:', formData);
      await onSubmit(formData as unknown as EventFormData);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleReset = () => {
    if (event) {
      reset({
        name: event.name,
        description: event.description || undefined,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        location: event.location || undefined,
        isActive: event.isActive,
        organizerIds: event.organizerAssignments?.map(a => a.organizer.id) || [],
      });
    } else {
      reset();
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="min-w-0 space-y-6">
      {/* Event Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Event Name *</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Enter event name"
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-sm text-red-500 dark:text-red-400">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Enter event description (optional)"
          rows={3}
          className={errors.description ? 'border-red-500' : ''}
        />
        {errors.description && (
          <p className="text-sm text-red-500 dark:text-red-400">{errors.description.message}</p>
        )}
      </div>

      {/* Date and Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Controller
          name="startDate"
          control={control}
          rules={{ required: 'Start date is required' }}
          render={({ field }) => (
            <DateTimePicker
              label="Start Date & Time *"
              value={field.value}
              onChange={field.onChange}
              error={errors.startDate?.message}
              minDate={new Date()}
            />
          )}
        />

        <Controller
          name="endDate"
          control={control}
          rules={{ 
            required: 'End date is required',
            validate: (value) => {
              const startDate = watch('startDate');
              if (startDate && value <= startDate) {
                return 'End date must be after start date';
              }
              return true;
            }
          }}
          render={({ field }) => (
            <DateTimePicker
              label="End Date & Time *"
              value={field.value}
              onChange={field.onChange}
              error={errors.endDate?.message}
              minDate={watchedStartDate || new Date()}
            />
          )}
        />
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="location"
            {...register('location')}
            placeholder="Enter event location (optional)"
            className={`pl-10 ${errors.location ? 'border-red-500' : ''}`}
          />
        </div>
        {errors.location && (
          <p className="text-sm text-red-500 dark:text-red-400">{errors.location.message}</p>
        )}
      </div>

      {/* Organizer Assignment */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Assign Organizers
        </Label>
        
        {organizerError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {organizerError}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOrganizers}
                className="ml-2 h-6"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        <Controller
          name="organizerIds"
          control={control}
          render={({ field }) => (
            <MultiSelect
              options={availableOrganizers.map(organizer => ({
                value: organizer.id,
                label: organizer.fullName,
                description: `${organizer.email} • ${organizer.role}`,
                disabled: !organizer.isActive,
              }))}
              value={field.value || []}
              onChange={field.onChange}
              placeholder="Select organizers to assign..."
              searchPlaceholder="Search organizers..."
              emptyMessage={loadingOrganizers ? "Loading organizers..." : "No organizers available"}
              maxDisplay={3}
              disabled={loadingOrganizers}
            />
          )}
        />
        
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Select organizers who will manage this event and track attendance. You can assign organizers later if needed.
        </p>
      </div>

      {/* Status (only for editing) */}
      {isEditing && (
        <div className="space-y-2">
          <Label htmlFor="isActive">Status</Label>
          <div className="flex items-center space-x-2">
            <input
              id="isActive"
              type="checkbox"
              {...register('isActive')}
              className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
            />
            <Label htmlFor="isActive" className="text-sm font-normal dark:text-gray-300">
              Event is active
            </Label>
          </div>
          {errors.isActive && (
            <p className="text-sm text-red-500 dark:text-red-400">{errors.isActive.message}</p>
          )}
        </div>
      )}

      {/* Form Actions */}
      <div className="flex flex-col-reverse items-stretch gap-3 pt-4 border-t dark:border-gray-700 sm:flex-row sm:items-center sm:justify-end sm:space-x-3 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isSubmitting}
        >
          <X className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Event' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
}
