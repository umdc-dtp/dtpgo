'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Save, X, Loader2, AlertTriangle, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionFormProps {
  eventId: string;
  session?: SessionFormData & { id?: string }; // Optional session for editing
  onSubmit: (sessionData: SessionFormData) => Promise<void>;
  onCancel: () => void;
  onSuccess?: () => void; // Callback for successful submission
  isSubmitting?: boolean;
}

export interface SessionFormData {
  name: string;
  description?: string;
  timeInStart: Date;
  timeInEnd: Date;
  timeOutStart?: Date;
  timeOutEnd?: Date;
  hasTimeout?: boolean;
  organizerIds?: string[];
  maxCapacity?: number;
  allowWalkIns?: boolean;
  requireRegistration?: boolean;
}

export function SessionForm({ eventId, session, onSubmit, onCancel, onSuccess, isSubmitting = false }: SessionFormProps) {
  const isEditing = !!session?.id;
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [conflictingSessions, setConflictingSessions] = useState<string[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [isFormSubmitted, setIsFormSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error' | 'conflict'>('idle');
  const checkingRef = useRef(false);
  const lastCheckedTimesRef = useRef<{
    timeInStart?: Date;
    timeInEnd?: Date;
    timeOutStart?: Date;
    timeOutEnd?: Date;
    hasTimeout?: boolean;
  }>({});
  const userInteractionRef = useRef<{
    isUserInteracting: boolean;
    lastInteractionTime: number;
    interactionTimeout?: NodeJS.Timeout;
  }>({
    isUserInteracting: false,
    lastInteractionTime: 0,
  });
  const conflictCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isValid, isDirty, isSubmitting: formIsSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<SessionFormData>({
    defaultValues: session ? {
      name: session.name,
      description: session.description || '',
      timeInStart: new Date(session.timeInStart),
      timeInEnd: new Date(session.timeInEnd),
      timeOutStart: session.timeOutStart ? new Date(session.timeOutStart) : undefined,
      timeOutEnd: session.timeOutEnd ? new Date(session.timeOutEnd) : undefined,
      hasTimeout: session.timeOutStart && session.timeOutEnd ? true : false,
      organizerIds: session.organizerIds || [],
      maxCapacity: session.maxCapacity,
      allowWalkIns: session.allowWalkIns ?? true,
      requireRegistration: session.requireRegistration ?? false,
    } : {
      name: '',
      description: '',
      timeInStart: new Date(),
      timeInEnd: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes later
      timeOutStart: new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
      timeOutEnd: new Date(Date.now() + 90 * 60 * 1000), // 1.5 hours later
      hasTimeout: true, // Default to having timeout
      organizerIds: [], // Will be populated by the parent component
      maxCapacity: undefined,
      allowWalkIns: true,
      requireRegistration: false,
    },
  });

  const watchedTimeInStart = watch('timeInStart');
  const watchedTimeInEnd = watch('timeInEnd');
  const watchedTimeOutStart = watch('timeOutStart');
  const watchedTimeOutEnd = watch('timeOutEnd');
  const watchedHasTimeout = watch('hasTimeout');
  
  // Track user interaction with time fields
  const markUserInteraction = useCallback(() => {
    const now = Date.now();
    userInteractionRef.current.isUserInteracting = true;
    userInteractionRef.current.lastInteractionTime = now;
    
    // Clear existing conflicts when user starts interacting with time fields
    setConflictError(null);
    setConflictingSessions([]);
    setSubmitStatus('idle'); // Reset submit status when user interacts
    
    // Clear existing timeout
    if (userInteractionRef.current.interactionTimeout) {
      clearTimeout(userInteractionRef.current.interactionTimeout);
    }
    
    // Set timeout to mark interaction as finished
    userInteractionRef.current.interactionTimeout = setTimeout(() => {
      userInteractionRef.current.isUserInteracting = false;
    }, 2000); // 2 seconds of inactivity = user finished
  }, []);
  
  // Helper function to check if time fields have actually changed and are meaningful
  const haveTimeFieldsChanged = useCallback((currentTimes: {
    timeInStart?: Date;
    timeInEnd?: Date;
    timeOutStart?: Date;
    timeOutEnd?: Date;
    hasTimeout?: boolean;
  }) => {
    const lastChecked = lastCheckedTimesRef.current;
    
    // If no previous check, consider it changed
    if (!lastChecked.timeInStart && !lastChecked.timeInEnd) {
      return true;
    }
    
    // Check if any time field has meaningfully changed
    const timeInStartChanged = currentTimes.timeInStart && lastChecked.timeInStart && 
      currentTimes.timeInStart.getTime() !== lastChecked.timeInStart.getTime();
    const timeInEndChanged = currentTimes.timeInEnd && lastChecked.timeInEnd && 
      currentTimes.timeInEnd.getTime() !== lastChecked.timeInEnd.getTime();
    const timeOutStartChanged = currentTimes.timeOutStart && lastChecked.timeOutStart && 
      currentTimes.timeOutStart.getTime() !== lastChecked.timeOutStart.getTime();
    const timeOutEndChanged = currentTimes.timeOutEnd && lastChecked.timeOutEnd && 
      currentTimes.timeOutEnd.getTime() !== lastChecked.timeOutEnd.getTime();
    const hasTimeoutChanged = lastChecked.hasTimeout !== currentTimes.hasTimeout;
    
    return timeInStartChanged || timeInEndChanged || timeOutStartChanged || timeOutEndChanged || hasTimeoutChanged;
  }, []);
  
  // Check if form has valid required fields based on validation schema
  const hasValidRequiredFields = () => {
    const formData = watch();
    
    // Required fields validation
    if (!formData.name?.trim() || formData.name.trim().length < 3) {
      return false;
    }
    
    if (!formData.timeInStart || !formData.timeInEnd) {
      return false;
    }
    
    // Time window validation
    if (formData.timeInEnd <= formData.timeInStart) {
      return false;
    }
    
    // Time window duration validation (15 minutes to 8 hours)
    const timeInDuration = formData.timeInEnd.getTime() - formData.timeInStart.getTime();
    const timeInDurationMinutes = timeInDuration / (1000 * 60);
    if (timeInDurationMinutes < 15 || timeInDurationMinutes > 8 * 60) {
      return false;
    }
    
    // Time-out window validation (if enabled)
    if (formData.hasTimeout) {
      if (!formData.timeOutStart || !formData.timeOutEnd) {
        return false;
      }
      
      if (formData.timeOutEnd <= formData.timeOutStart) {
        return false;
      }
      
      // Time-out window duration validation (15 minutes to 8 hours)
      const timeOutDuration = formData.timeOutEnd.getTime() - formData.timeOutStart.getTime();
      const timeOutDurationMinutes = timeOutDuration / (1000 * 60);
      if (timeOutDurationMinutes < 15 || timeOutDurationMinutes > 8 * 60) {
        return false;
      }
      
      // Gap validation (at least 5 minutes between time-in end and time-out start)
      const gap = formData.timeOutStart.getTime() - formData.timeInEnd.getTime();
      const gapMinutes = gap / (1000 * 60);
      if (gapMinutes < 5) {
        return false;
      }
    }
    
    return true;
  };
  
  // Check if form can be submitted (valid and either dirty for editing or has content for creating)
  const canSubmit = () => {
    const hasValidFields = hasValidRequiredFields();
    const hasConflicts = conflictError !== null;
    const isCurrentlySubmitting = isSubmitting || submitStatus === 'submitting';
    
    if (isCurrentlySubmitting) {
      return false; // Don't allow submission while already submitting
    }
    
    if (isEditing) {
      return hasValidFields && isDirty && !hasConflicts;
    }
    return hasValidFields && !hasConflicts;
  };
  
  
  // Get validation status for user feedback
  const getValidationStatus = () => {
    const formData = watch();
    const issues: string[] = [];
    
    if (!formData.name?.trim()) {
      issues.push('Session name is required');
    } else if (formData.name.trim().length < 3) {
      issues.push('Session name must be at least 3 characters');
    }
    
    if (!formData.timeInStart || !formData.timeInEnd) {
      issues.push('Time windows are required');
    } else if (formData.timeInEnd <= formData.timeInStart) {
      issues.push('Time-in end must be after time-in start');
    } else {
      const timeInDuration = formData.timeInEnd.getTime() - formData.timeInStart.getTime();
      const timeInDurationMinutes = timeInDuration / (1000 * 60);
      if (timeInDurationMinutes < 15) {
        issues.push('Time-in window must be at least 15 minutes');
      } else if (timeInDurationMinutes > 8 * 60) {
        issues.push('Time-in window cannot exceed 8 hours');
      }
    }
    
    if (formData.hasTimeout) {
      if (!formData.timeOutStart || !formData.timeOutEnd) {
        issues.push('Time-out windows are required when timeout is enabled');
      } else if (formData.timeOutEnd <= formData.timeOutStart) {
        issues.push('Time-out end must be after time-out start');
      } else {
        const timeOutDuration = formData.timeOutEnd.getTime() - formData.timeOutStart.getTime();
        const timeOutDurationMinutes = timeOutDuration / (1000 * 60);
        if (timeOutDurationMinutes < 15) {
          issues.push('Time-out window must be at least 15 minutes');
        } else if (timeOutDurationMinutes > 8 * 60) {
          issues.push('Time-out window cannot exceed 8 hours');
        }
        
        const gap = formData.timeOutStart.getTime() - formData.timeInEnd.getTime();
        const gapMinutes = gap / (1000 * 60);
        if (gapMinutes < 5) {
          issues.push('There must be at least 5 minutes between time-in and time-out windows');
        }
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  };

  // Auto-adjust time windows to maintain logical order
  useEffect(() => {
    if (watchedTimeInStart && watchedTimeInEnd) {
      if (watchedTimeInEnd <= watchedTimeInStart) {
        // Set time-in end to 30 minutes after time-in start
        const newTimeInEnd = new Date(watchedTimeInStart.getTime() + 30 * 60 * 1000);
        setValue('timeInEnd', newTimeInEnd);
      }
    }
  }, [watchedTimeInStart, watchedTimeInEnd, setValue]);

  useEffect(() => {
    if (watchedTimeInEnd && watchedTimeOutStart && watchedHasTimeout) {
      if (watchedTimeOutStart <= watchedTimeInEnd) {
        // Set time-out start to 30 minutes after time-in end
        const newTimeOutStart = new Date(watchedTimeInEnd.getTime() + 30 * 60 * 1000);
        setValue('timeOutStart', newTimeOutStart);
      }
    }
  }, [watchedTimeInEnd, watchedTimeOutStart, watchedHasTimeout, setValue]);

  // Handle timeout toggle
  useEffect(() => {
    if (!watchedHasTimeout) {
      // Clear timeout values when timeout is disabled
      setValue('timeOutStart', undefined);
      setValue('timeOutEnd', undefined);
    } else if (watchedTimeInEnd) {
      // Set default timeout values when timeout is enabled
      const defaultTimeOutStart = new Date(watchedTimeInEnd.getTime() + 30 * 60 * 1000);
      const defaultTimeOutEnd = new Date(defaultTimeOutStart.getTime() + 30 * 60 * 1000);
      setValue('timeOutStart', defaultTimeOutStart);
      setValue('timeOutEnd', defaultTimeOutEnd);
    }
  }, [watchedHasTimeout, watchedTimeInEnd, setValue]);

  // Check for conflicts with existing sessions
  const checkForConflicts = useCallback(async (formData: SessionFormData) => {
    // Only skip if currently submitting or already checking
    if (isSubmitting || checkingRef.current) return;
    
    // Enhanced validation before making API call
    if (!formData.name?.trim() || 
        !formData.timeInStart || 
        !formData.timeInEnd ||
        !eventId ||
        formData.timeInEnd <= formData.timeInStart) {
      setConflictError(null);
      setConflictingSessions([]);
      return;
    }
    
    // Additional validation for timeout fields if enabled
    if (formData.hasTimeout && (!formData.timeOutStart || !formData.timeOutEnd || formData.timeOutEnd <= formData.timeOutStart)) {
      setConflictError(null);
      setConflictingSessions([]);
      return;
    }
    
    setIsCheckingConflicts(true);
    checkingRef.current = true;
    
    try {
      // Create a properly formatted session data for conflict checking
      const tempData = {
        name: formData.name.trim(),
        description: formData.description || '',
        eventId: eventId,
        timeInStart: formData.timeInStart.toISOString(),
        timeInEnd: formData.timeInEnd.toISOString(),
        timeOutStart: formData.hasTimeout && formData.timeOutStart ? formData.timeOutStart.toISOString() : undefined,
        timeOutEnd: formData.hasTimeout && formData.timeOutEnd ? formData.timeOutEnd.toISOString() : undefined,
        hasTimeout: formData.hasTimeout || false,
        organizerIds: [], // Will be populated by parent component
        maxCapacity: formData.maxCapacity,
        allowWalkIns: formData.allowWalkIns ?? true,
        requireRegistration: formData.requireRegistration ?? false,
      };
      
      console.log('Checking conflicts with data:', tempData);
      
      const response = await fetch('/api/admin/sessions?checkConflicts=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tempData),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (response.status === 409 && result.conflictingSessions) {
          setConflictError('Time windows conflict with existing sessions');
          setConflictingSessions(result.conflictingSessions);
          setSubmitStatus('conflict');
        } else {
          // Log detailed validation errors for debugging
          console.log('Conflict check validation error:', result);
          if (result.details) {
            console.log('Validation details:', result.details);
          }
          setConflictError(null);
          setConflictingSessions([]);
          setSubmitStatus('idle');
        }
      } else {
        // Clear conflicts if none found
        setConflictError(null);
        setConflictingSessions([]);
        setSubmitStatus('idle');
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
      // Don't show error to user, just clear conflicts
      setConflictError(null);
      setConflictingSessions([]);
    } finally {
      setIsCheckingConflicts(false);
      checkingRef.current = false;
    }
  }, [isSubmitting, eventId]);

  // Debounced conflict checking when time fields change (for new sessions only)
  useEffect(() => {
    const currentTimes = {
      timeInStart: watchedTimeInStart,
      timeInEnd: watchedTimeInEnd,
      timeOutStart: watchedTimeOutStart,
      timeOutEnd: watchedTimeOutEnd,
      hasTimeout: watchedHasTimeout,
    };

    // Only check conflicts if:
    // 1. We're not editing (for new sessions only)
    // 2. Form has valid required fields
    // 3. We're not already checking conflicts
    // 4. We're not currently submitting the form
    // 5. Form hasn't been successfully submitted yet
    // 6. Time fields have actually changed
    if (!isEditing && 
        hasValidRequiredFields() && 
        !checkingRef.current &&
        !isSubmitting &&
        !isFormSubmitted &&
        haveTimeFieldsChanged(currentTimes)) {
      
      // Clear any existing timeout
      if (conflictCheckTimeoutRef.current) {
        clearTimeout(conflictCheckTimeoutRef.current);
      }
      
      // Debounce the conflict check by 500ms to prevent excessive API calls
      conflictCheckTimeoutRef.current = setTimeout(() => {
        // Get current form data for conflict checking
        const formData = watch();
        
        console.log('Triggering debounced conflict check for:', formData.name, 'after time fields changed');
        checkForConflicts(formData);
        
        // Update the last checked times to prevent duplicate checks
        lastCheckedTimesRef.current = {
          timeInStart: currentTimes.timeInStart,
          timeInEnd: currentTimes.timeInEnd,
          timeOutStart: currentTimes.timeOutStart,
          timeOutEnd: currentTimes.timeOutEnd,
          hasTimeout: currentTimes.hasTimeout,
        };
      }, 500);
    }
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (conflictCheckTimeoutRef.current) {
        clearTimeout(conflictCheckTimeoutRef.current);
      }
    };
  }, [watchedTimeInStart, watchedTimeInEnd, watchedTimeOutStart, watchedTimeOutEnd, watchedHasTimeout, checkForConflicts, isEditing, isSubmitting, isFormSubmitted, hasValidRequiredFields, haveTimeFieldsChanged]);

  // Reset form submission state when session prop changes (new session)
  useEffect(() => {
    if (!session) {
      setIsFormSubmitted(false);
    }
  }, [session]);

  const handleFormSubmit = handleSubmit(async (data: SessionFormData) => {
    console.log('Form submit triggered with data:', data);
    console.log('Form errors:', errors);
    console.log('Is submitting:', isSubmitting);
    
    // Set submitting status
    setSubmitStatus('submitting');
    
    // Clear previous conflict errors
    setConflictError(null);
    setConflictingSessions([]);
    
    try {
      // Convert Date objects to ISO strings for API submission
      const formData = {
        ...data,
        timeInStart: data.timeInStart.toISOString(),
        timeInEnd: data.timeInEnd.toISOString(),
        // Omit disabled timeout fields; the API accepts optional strings, not null.
        timeOutStart: data.hasTimeout && data.timeOutStart ? data.timeOutStart.toISOString() : undefined,
        timeOutEnd: data.hasTimeout && data.timeOutEnd ? data.timeOutEnd.toISOString() : undefined,
      };

      console.log('Submitting session form data:', formData);
      await onSubmit(formData as unknown as SessionFormData);
      
      // Mark form as successfully submitted
      setSubmitStatus('success');
      setIsFormSubmitted(true);
      console.log('Form submitted successfully, stopping conflict checking');
      
      // Call onSuccess callback to close the form
      if (onSuccess) {
        // Delay the callback slightly to show success state
        setTimeout(() => {
          onSuccess();
        }, 1500); // Show success for 1.5 seconds before closing
      }
      
      // Reset success status after 2 seconds (fallback if no onSuccess callback)
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Session creation failed:', error);
      setSubmitStatus('error');
      
      // Reset error status after 3 seconds
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 3000);
    }
  }, (errors) => {
    console.log('Form validation failed:', errors);
    console.log('Validation errors:', errors);
    setSubmitStatus('error');
    
    // Reset error status after 2 seconds
    setTimeout(() => {
      setSubmitStatus('idle');
    }, 2000);
  });

  const handleReset = () => {
    reset();
    setIsFormSubmitted(false); // Reset form submission state
    setConflictError(null);
    setConflictingSessions([]);
    setSubmitStatus('idle'); // Reset submit status
    // Reset last checked times
    lastCheckedTimesRef.current = {};
    // Reset user interaction state
    userInteractionRef.current.isUserInteracting = false;
    if (userInteractionRef.current.interactionTimeout) {
      clearTimeout(userInteractionRef.current.interactionTimeout);
    }
    // Clear conflict check timeout
    if (conflictCheckTimeoutRef.current) {
      clearTimeout(conflictCheckTimeoutRef.current);
    }
  };

  return (
    <div className="max-h-[calc(90vh-8rem)] overflow-y-auto">
      <form onSubmit={(e) => {
        console.log('Form onSubmit event triggered');
        handleFormSubmit(e);
      }} className="space-y-4">
      {/* Session Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Session Name *</Label>
        <Input
          id="name"
          {...register('name', { required: 'Session name is required' })}
          placeholder="Enter session name"
          className={cn(errors.name && 'border-red-500')}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Enter session description (optional)"
          rows={3}
          className={cn(errors.description && 'border-red-500')}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Timeout Toggle */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="hasTimeout"
            {...register('hasTimeout')}
            onChange={(e) => {
              markUserInteraction(); // Mark that user is interacting
              register('hasTimeout').onChange(e); // Call the original onChange
            }}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <Label htmlFor="hasTimeout" className="text-sm font-medium">
            Enable Time-Out Window
          </Label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Check this box if you want to track when students leave the session. Leave unchecked for sessions that only track arrival.
        </p>
      </div>

      {/* Time Windows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Controller
          name="timeInStart"
          control={control}
          rules={{ required: 'Time-in start is required' }}
          render={({ field }) => (
            <DateTimePicker
              label="Time-In Start *"
              value={field.value}
              onChange={(value) => {
                markUserInteraction(); // Mark that user is interacting
                field.onChange(value);
              }}
              error={errors.timeInStart?.message}
              minDate={new Date()}
            />
          )}
        />

        <Controller
          name="timeInEnd"
          control={control}
          rules={{ 
            required: 'Time-in end is required',
            validate: (value) => {
              const timeInStart = watch('timeInStart');
              if (timeInStart && value <= timeInStart) {
                return 'Time-in end must be after time-in start';
              }
              return true;
            }
          }}
          render={({ field }) => (
            <DateTimePicker
              label="Time-In End *"
              value={field.value}
              onChange={(value) => {
                markUserInteraction(); // Mark that user is interacting
                field.onChange(value);
              }}
              error={errors.timeInEnd?.message}
              minDate={watchedTimeInStart || new Date()}
            />
          )}
        />

        <Controller
          name="timeOutStart"
          control={control}
          rules={{ 
            required: watchedHasTimeout ? 'Time-out start is required' : false,
            validate: (value) => {
              if (!watchedHasTimeout) return true;
              const timeInEnd = watch('timeInEnd');
              if (timeInEnd && value && value <= timeInEnd) {
                return 'Time-out start must be after time-in end';
              }
              return true;
            }
          }}
          render={({ field }) => (
            <DateTimePicker
              label="Time-Out Start"
              value={field.value}
              onChange={(value) => {
                markUserInteraction(); // Mark that user is interacting
                field.onChange(value);
              }}
              error={errors.timeOutStart?.message}
              minDate={watchedTimeInEnd || new Date()}
              disabled={!watchedHasTimeout}
            />
          )}
        />

        <Controller
          name="timeOutEnd"
          control={control}
          rules={{ 
            required: watchedHasTimeout ? 'Time-out end is required' : false,
            validate: (value) => {
              if (!watchedHasTimeout) return true;
              const timeOutStart = watch('timeOutStart');
              if (timeOutStart && value && value <= timeOutStart) {
                return 'Time-out end must be after time-out start';
              }
              return true;
            }
          }}
          render={({ field }) => (
            <DateTimePicker
              label="Time-Out End"
              value={field.value}
              onChange={(value) => {
                markUserInteraction(); // Mark that user is interacting
                field.onChange(value);
              }}
              error={errors.timeOutEnd?.message}
              minDate={watchedTimeOutStart || new Date()}
              disabled={!watchedHasTimeout}
            />
          )}
        />
      </div>

      {/* Validation Status */}
      {(() => {
        const validationStatus = getValidationStatus();
        if (!validationStatus.isValid && (isDirty || !isEditing)) {
          return (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                Please fix the following issues:
              </h4>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {validationStatus.issues.map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return null;
      })()}

      {/* Conflict Status */}
      {conflictError && (
        <div className="p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mr-2 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                Session Time Conflict Detected
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">
                {conflictError}
              </p>
              {conflictingSessions.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Conflicting sessions:
                  </p>
                  <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
                    {conflictingSessions.map((sessionName, index) => (
                      <li key={index} className="flex items-center">
                        <Clock className="h-3 w-3 mr-2" />
                        <span>{sessionName}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Please adjust your time windows to avoid conflicts with existing sessions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-checking indicator */}
      {isCheckingConflicts && !isEditing && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Checking for time conflicts...
            </span>
          </div>
        </div>
      )}

      {/* Form Status Indicator */}
      {isSubmitting && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {isEditing ? 'Saving session changes...' : 'Creating new session...'}
            </span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Please wait while we process your request. Do not close this window.
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-2 pt-3 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isSubmitting}
          className={cn(
            isSubmitting && "cursor-not-allowed opacity-50"
          )}
        >
          <X className="h-4 w-4 mr-2" />
          Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className={cn(
            isSubmitting && "cursor-not-allowed opacity-50"
          )}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !canSubmit()}
          className={cn(
            "min-w-[140px] transition-all duration-200", // Ensure consistent button width and smooth transitions
            submitStatus === 'submitting' && "cursor-not-allowed opacity-75",
            submitStatus === 'success' && "bg-green-600 hover:bg-green-700 text-white",
            submitStatus === 'error' && "bg-red-600 hover:bg-red-700 text-white",
            submitStatus === 'conflict' && "bg-orange-600 hover:bg-orange-700 text-white",
          )}
          onClick={() => {
            console.log('Submit button clicked');
            console.log('Form state:', { 
              isSubmitting, 
              formIsSubmitting,
              isValid, 
              isDirty,
              errors,
              canSubmit: canSubmit(),
              hasValidRequiredFields: hasValidRequiredFields(),
              submitStatus
            });
          }}
        >
          {submitStatus === 'submitting' || isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? 'Saving...' : 'Creating...'}
            </>
          ) : submitStatus === 'success' ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              {isEditing ? 'Saved!' : 'Created!'}
            </>
          ) : submitStatus === 'error' ? (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              {isEditing ? 'Save Failed' : 'Creation Failed'}
            </>
          ) : submitStatus === 'conflict' ? (
            <>
              <AlertCircle className="h-4 w-4 mr-2" />
              {isEditing ? 'Time Conflict' : 'Time Conflict'}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? 'Save Changes' : 'Create Session'}
            </>
          )}
        </Button>
      </div>
    </form>
    </div>
  );
}
