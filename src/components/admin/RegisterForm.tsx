'use client';

import React, { useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { studentSchema, StudentFormInput } from '@/lib/validations/student';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeDisplay } from '@/components/ui/QRCodeDisplay';
import { toast } from 'sonner';
import { User, Mail, GraduationCap, Calendar, CheckCircle, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import useSWR from 'swr';

type Program = {
  id: string;
  name: string;
  displayName?: string;
};

interface RegisterFormProps {
  onSubmit: (data: StudentFormInput) => Promise<{ studentId?: string } | void>;
  isSubmitting: boolean;
  initialData?: Partial<StudentFormInput>;
  hideHeader?: boolean;
}

// Popular email domains with gmail.com at top
const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
];

export function RegisterForm({ onSubmit, isSubmitting, initialData, hideHeader = false }: RegisterFormProps) {
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredStudentId, setRegisteredStudentId] = useState<string | null>(null);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const { user, loading: authLoading } = useAuth();
  const { data: programs = [], error: programsError, isLoading: programsLoading } = useSWR<Program[]>(
    user && !authLoading ? '/api/admin/programs' : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch programs');
      const data = await res.json();
      return data.programs ?? [];
    },
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (programsError) toast.error('Failed to load programs');
  }, [programsError]);

  const form = useForm<StudentFormInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: initialData || {
      studentIdNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      year: 1,
      programId: '',
    },
  });

  // Watch form values for email suggestions and program display
  const emailValue = form.watch('email');
  const programIdValue = form.watch('programId');

  // Get selected program's short name for display
  const selectedProgram = programs.find(p => p.id === programIdValue);
  const selectedProgramDisplay = selectedProgram ? selectedProgram.name : '';

  // Handle name transformation on blur
  const handleNameBlur = (field: 'firstName' | 'lastName', value: string) => {
    if (value && value !== value.toUpperCase()) {
      form.setValue(field, value.toUpperCase(), { shouldValidate: true });
    }
  };

  // Email domain suggestions logic
  useEffect(() => {
    if (emailValue && emailValue.includes('@')) {
      const [localPart, domainPart] = emailValue.split('@');
      if (domainPart && domainPart.length > 0) {
        const suggestions = EMAIL_DOMAINS
          .filter(domain => domain.toLowerCase().startsWith(domainPart.toLowerCase()))
          .map(domain => `${localPart}@${domain}`);
        setEmailSuggestions(suggestions);
        setShowEmailSuggestions(suggestions.length > 0 && domainPart !== domainPart.toLowerCase());
      } else {
        setShowEmailSuggestions(false);
      }
    } else if (emailValue && !emailValue.includes('@')) {
      // Show suggestions when user starts typing without @
      const suggestions = EMAIL_DOMAINS.map(domain => `${emailValue}@${domain}`);
      setEmailSuggestions(suggestions);
      setShowEmailSuggestions(emailValue.length > 0);
    } else {
      setShowEmailSuggestions(false);
    }
  }, [emailValue]);

  const selectEmailSuggestion = (suggestion: string) => {
    form.setValue('email', suggestion);
    setShowEmailSuggestions(false);
    form.clearErrors('email');
  };

  const handleFormSubmit: SubmitHandler<StudentFormInput> = async (data) => {
    try {
      setRegistrationSuccess(false);
      // Transform names to uppercase before submission
      const transformedData = {
        ...data,
        firstName: data.firstName.toUpperCase(),
        lastName: data.lastName.toUpperCase(),
      };
      
      const result = await onSubmit(transformedData);
      
      console.log('Registration result:', result);
      console.log('Transformed data:', transformedData);
      
      // If onSubmit returns a student ID, show QR code
      if (result && typeof result === 'object' && result.studentId) {
        console.log('Using returned student ID:', result.studentId);
        setRegisteredStudentId(result.studentId);
        setRegistrationSuccess(true);
      } else {
        // Fallback: try to get student ID from the submitted data
        // This assumes the student ID number can be used as the student ID
        console.warn('No student ID returned from onSubmit, using student ID number as fallback');
        console.log('Using fallback student ID:', transformedData.studentIdNumber);
        setRegisteredStudentId(transformedData.studentIdNumber);
        setRegistrationSuccess(true);
      }
    } catch (error) {
      setRegistrationSuccess(false);
      console.error('Registration failed:', error);
    }
  };

  // Show QR code if registration was successful
  if (registrationSuccess && registeredStudentId) {
    return <QRCodeDisplay studentId={registeredStudentId} />;
  }

  // Show loading state while programs are being fetched
  if (authLoading || (user && programsLoading && !programsError)) {
    return (
      <div className="py-2 sm:py-4">
        <div className="relative">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium mb-3">
              <UserPlus className="size-3.5" />
              <span>Admin Registration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Register New Student</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-prose">
              Loading programs...
            </p>
          </div>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4">
      <div className="relative">
        {/* Header Section */}
        {!hideHeader && (
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium mb-3">
              <UserPlus className="size-3.5" />
              <span>Admin Registration</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Register New Student</h1>
            
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-prose">
              Add a student to the system and automatically generate a QR code for event access.
            </p>
          </div>
        )}

        {/* Registration Form Card */}
        <div className="group relative overflow-hidden rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="relative p-6 sm:p-8 space-y-6">
              {/* Student ID */}
              <FormField
                control={form.control}
                name="studentIdNumber"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="size-4 text-yellow-600" />
                      <FormLabel className="font-semibold text-gray-900 dark:text-gray-100">Student ID Number</FormLabel>
                    </div>
                    <FormControl>
                      <Input 
                        {...field}
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Input student ID number"
                        className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-semibold text-gray-900 dark:text-gray-100">First Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          placeholder="Juan"
                          className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400/20 transition-colors"
                          onBlur={(e) => handleNameBlur('firstName', e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="font-semibold text-gray-900 dark:text-gray-100">Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          placeholder="Dela Cruz"
                          className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400/20 transition-colors"
                          onBlur={(e) => handleNameBlur('lastName', e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email with Suggestions */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2 relative">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="size-4 text-yellow-600" />
                      <FormLabel className="font-semibold text-gray-900 dark:text-gray-100">Email Address</FormLabel>
                    </div>
                    <FormControl>
                      <Input 
                        {...field}
                        type="email"
                        placeholder="juan.delacruz@gmail.com"
                        className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400/20 transition-colors"
                        onFocus={() => emailValue && setShowEmailSuggestions(emailSuggestions.length > 0)}
                        onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 200)}
                      />
                    </FormControl>
                    
                    {/* Email Suggestions Dropdown */}
                    {showEmailSuggestions && emailSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {emailSuggestions.slice(0, 6).map((suggestion, index) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-yellow-50 dark:hover:bg-gray-700 hover:text-yellow-800 dark:hover:text-gray-200 transition-colors text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => selectEmailSuggestion(suggestion)}
                          >
                            <span className="flex items-center gap-2">
                              <Mail className="size-3 text-gray-400 dark:text-gray-500" />
                              {suggestion}
                              {index === 0 && suggestion.includes('gmail.com') && (
                                <span className="ml-auto text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded">Popular</span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Program and Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="programId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <GraduationCap className="size-4 text-yellow-600" />
                        <FormLabel className="font-semibold text-gray-900 dark:text-gray-100">Program</FormLabel>
                      </div>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400/20">
                            <SelectValue placeholder="Select program" className="truncate text-left">
                              {selectedProgramDisplay || "Select program"}
                            </SelectValue>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-w-[400px]">
                          {programs.map((program) => (
                            <SelectItem key={program.id} value={program.id} className="hover:bg-yellow-50 py-3">
                              <div className="flex flex-col items-start gap-0.5 w-full">
                                <span className="font-medium text-sm leading-tight truncate w-full">{program.name}</span>
                                {program.displayName && (
                                  <span className="text-xs text-gray-400 leading-tight truncate w-full">({program.displayName})</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="size-4 text-yellow-600" />
                        <FormLabel className="font-semibold text-gray-900 dark:text-gray-100">Year Level</FormLabel>
                      </div>
                      <Select onValueChange={(value) => field.onChange(parseInt(value, 10))} defaultValue={String(field.value)}>
                        <FormControl>
                          <SelectTrigger className="h-12 border-gray-200 focus:border-yellow-400 focus:ring-yellow-400/20">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => (
                            <SelectItem key={y} value={String(y)} className="hover:bg-yellow-50">
                              <span className="font-medium">{y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className={`w-full h-12 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 group/btn ${
                    isSubmitting 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 hover:shadow-lg' 
                      : registrationSuccess
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                  }`}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent" />
                      <span>Registering...</span>
                    </div>
                  ) : registrationSuccess ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-4" />
                      <span>Registration Successful!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus className="size-4 group-hover/btn:scale-110 transition-transform" />
                      <span>Register Student</span>
                    </div>
                  )}
                </Button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="size-3 text-green-500" />
                    <span>Admin Access</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="size-3 text-green-500" />
                    <span>Instant QR Generation</span>
                  </div>
                </div>
              </div>
            </form>
          </Form>

          {/* Bottom Accent Line */}
          <div className={`h-0.5 w-full ${
            registrationSuccess 
              ? 'bg-green-400' 
              : isSubmitting 
              ? 'bg-gray-300'
              : 'bg-yellow-400'
          }`} />
        </div>
      </div>
    </div>
  );
}

export default RegisterForm; 
