'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Helper function to format time for display
const formatTimeForDisplay = (timeValue: string): string => {
  if (!timeValue) return '12:00 AM';
  const [hours, minutes] = timeValue.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  className,
  label,
  error,
  minDate,
  maxDate,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  const [timeValue, setTimeValue] = React.useState<string>(value ? format(value, 'HH:mm') : '');

  React.useEffect(() => {
    setSelectedDate(value);
    setTimeValue(value ? format(value, 'HH:mm') : '');
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const now = new Date();
      const [hours, minutes] = (timeValue || format(now, 'HH:mm')).split(':').map(Number);
      const newDateTime = new Date(date);
      newDateTime.setHours(hours, minutes, 0, 0);
      onChange?.(newDateTime);
    } else {
      onChange?.(undefined);
    }
  };

  const handleTimeChange = (time: string) => {
    setTimeValue(time);
    if (selectedDate && time) {
      const [hours, minutes] = time.split(':').map(Number);
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(hours, minutes, 0, 0);
      onChange?.(newDateTime);
    }
  };


  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
      )}
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full h-12 justify-start text-left font-normal px-4 py-3',
                !selectedDate && 'text-muted-foreground',
                error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
                disabled && 'cursor-not-allowed opacity-50',
                'hover:bg-gray-50 focus:ring-2 focus:ring-primary/20 focus:border-[--color-border-accent]'
              )}
              disabled={disabled}
            >
              <div className="flex items-center gap-3 w-full">
                <CalendarIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {selectedDate ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{format(selectedDate, 'MMM dd, yyyy')}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">{formatTimeForDisplay(timeValue)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select date and time</span>
                  )}
                </div>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-y-auto p-0"
            align="start"
            side="bottom"
            sideOffset={8}
            avoidCollisions
            collisionPadding={8}
          >
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Select Date</h4>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => {
                      if (disabled) return true;
                      if (minDate && date < minDate) return true;
                      if (maxDate && date > maxDate) return true;
                      return false;
                    }}
                    initialFocus
                    className="rounded-md border bg-white"
                  />
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Select Time</h4>
                  <div className="relative">
                    <Input
                      type="time"
                      step={60}
                      value={timeValue}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className={cn('h-10', error && 'border-red-500 focus:border-red-500')}
                      disabled={disabled}
                      placeholder="HH:MM"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <span className="text-red-500">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  error?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled = false,
  className,
  label,
  error,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn('space-y-3', className)}>
      {label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
      )}
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full h-12 justify-start text-left font-normal px-4 py-3',
              !value && 'text-muted-foreground',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              disabled && 'cursor-not-allowed opacity-50',
              'hover:bg-gray-50 focus:ring-2 focus:ring-primary/20 focus:border-[--color-border-accent]'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-3 h-4 w-4 text-gray-500" />
            <span className="font-medium">
              {value ? format(value, 'MMM dd, yyyy') : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" side="bottom">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={(date) => {
              if (disabled) return true;
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <span className="text-red-500">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}
