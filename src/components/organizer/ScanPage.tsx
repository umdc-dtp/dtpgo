'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRScanner } from './QRScanner';
import { ManualInput } from './ManualInput';
import { SessionSelector } from './SessionSelector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  MapPin, 
  Users,
  AlertCircle,
  CheckCircle2,
  Camera,
  Scan,
  Keyboard
} from 'lucide-react';
import { toast } from 'sonner';

interface Session {
  id: string;
  name: string;
  description?: string;
  eventId: string;
  event: {
    id: string;
    name: string;
    location?: string;
    startDate: string;
    endDate: string;
  };
  timeInStart: string;
  timeInEnd: string;
  timeOutStart?: string;
  timeOutEnd?: string;
  isActive: boolean;
  _count: {
    attendance: number;
  };
}

export function ScanPage() {
  const searchParams = useSearchParams();
  
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'select' | 'scan'>('select');
  const [inputMode, setInputMode] = useState<'qr' | 'manual'>('qr');
  const [attendanceStats, setAttendanceStats] = useState({
    totalScanned: 0,
    lastScanTime: null as Date | null,
  });
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);

  // Get sessionId from URL params
  const sessionIdFromUrl = searchParams.get('sessionId');

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Auto-select session if sessionId is in URL
  useEffect(() => {
    if (sessionIdFromUrl && sessions.length > 0) {
      const session = sessions.find(s => s.id === sessionIdFromUrl);
      if (session) {
        setSelectedSession(session);
        setScanMode('scan');
      }
    }
  }, [sessionIdFromUrl, sessions]);

  // Handle page leave warning when scanner is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isScanningActive) {
        e.preventDefault();
        e.returnValue = 'You are currently scanning QR codes. Are you sure you want to leave?';
        return 'You are currently scanning QR codes. Are you sure you want to leave?';
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isScanningActive) {
        e.preventDefault();
        setShowLeaveDialog(true);
        // Store the intended navigation
        pendingNavigationRef.current = 'back';
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isScanningActive]);

  // Cleanup scanner when component unmounts
  useEffect(() => {
    return () => {
      if ((window as unknown as { __qrScannerCleanup?: () => void }).__qrScannerCleanup) {
        (window as unknown as { __qrScannerCleanup: () => void }).__qrScannerCleanup();
      }
    };
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/organizer/sessions');
      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load sessions';
      setError(errorMessage);
      toast.error('Error loading sessions', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = (session: Session) => {
    setSelectedSession(session);
    setScanMode('scan');
    
    // Update URL with sessionId
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', session.id);
    window.history.replaceState({}, '', url.toString());
  };

  const handleBackToSessions = () => {
    if (isScanningActive) {
      setShowLeaveDialog(true);
      pendingNavigationRef.current = 'sessions';
      return;
    }
    
    setSelectedSession(null);
    setScanMode('select');
    
    // Remove sessionId from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('sessionId');
    window.history.replaceState({}, '', url.toString());
  };

  const handleConfirmLeave = async () => {
    // Clean up scanner
    if ((window as unknown as { __qrScannerCleanup?: () => Promise<void> }).__qrScannerCleanup) {
      await (window as unknown as { __qrScannerCleanup: () => Promise<void> }).__qrScannerCleanup();
    }
    
    setIsScanningActive(false);
    setShowLeaveDialog(false);
    
    // Execute pending navigation
    const navigation = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    
    if (navigation === 'sessions') {
      setSelectedSession(null);
      setScanMode('select');
      
      // Remove sessionId from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('sessionId');
      window.history.replaceState({}, '', url.toString());
    } else if (navigation === 'back') {
      // Go back in history
      window.history.back();
    }
  };

  const handleCancelLeave = () => {
    setShowLeaveDialog(false);
    pendingNavigationRef.current = null;
  };

  const handleScannerCleanup = () => {
    setIsScanningActive(false);
  };

  const handleScanningStateChange = (isScanning: boolean) => {
    setIsScanningActive(isScanning);
  };

  // Cleanup scanner when switching input modes
  useEffect(() => {
    // When switching away from QR mode, ensure scanner is cleaned up
    if (inputMode !== 'qr' && (window as unknown as { __qrScannerCleanup?: () => Promise<void> }).__qrScannerCleanup) {
      (window as unknown as { __qrScannerCleanup: () => Promise<void> }).__qrScannerCleanup();
    }
  }, [inputMode]);

  const handleAttendanceRecorded = () => {
    setAttendanceStats(prev => ({
      totalScanned: prev.totalScanned + 1,
      lastScanTime: new Date(),
    }));
    
    toast.success('Attendance recorded successfully!', {
      description: `Total scanned: ${attendanceStats.totalScanned + 1}`,
    });
  };

  // Error handling is done inline in the QRScanner component
  // const handleError = (errorMessage: string) => {
  //   setError(errorMessage);
  //   toast.error('Scanner Error', {
  //     description: errorMessage,
  //   });
  // };

  if (loading) {
    return (
      <Card className="w-full max-w-5xl mx-auto bg-card/50 backdrop-blur-xl border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-foreground">Loading Sessions...</CardTitle>
          <CardDescription className="text-muted-foreground">Please wait while we load your available sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-5xl mx-auto bg-card/50 backdrop-blur-xl border-border">
        <CardHeader>
          <CardTitle className="text-red-600 dark:text-red-400">Error Loading Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="border-red-500/50 bg-red-500/10 dark:border-red-900/50 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-600 dark:text-red-300">
              {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={loadSessions} variant="outline" className="border-border text-foreground hover:bg-muted">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scanMode === 'scan' && selectedSession) {
    return (
      <>
        <div className="space-y-4 sm:space-y-6">
        {/* Floating Stats Counter */}
        <div className="fixed top-4 right-4 z-50 hidden sm:block">
          <div className="bg-gradient-to-br from-yellow-500 to-amber-500 dark:from-yellow-600 dark:to-amber-600 backdrop-blur-xl border border-white/20 rounded-xl p-2 sm:p-3 shadow-lg shadow-yellow-500/30 dark:shadow-yellow-900/30">
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold text-white mb-0.5">
                {attendanceStats.totalScanned}
              </div>
              <div className="text-[8px] sm:text-[10px] text-white/90 uppercase tracking-wider">
                <span className="hidden sm:inline">Scanned Today</span>
                <span className="sm:hidden">Today</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile counter - bottom right */}
        <div className="fixed bottom-4 right-4 z-50 sm:hidden">
          <div className="bg-gradient-to-br from-yellow-500 to-amber-500 dark:from-yellow-600 dark:to-amber-600 backdrop-blur-xl border border-white/20 rounded-xl p-2 shadow-lg shadow-yellow-500/30 dark:shadow-yellow-900/30">
            <div className="text-center">
              <div className="text-lg font-bold text-white mb-0.5">
                {attendanceStats.totalScanned}
              </div>
              <div className="text-[8px] text-white/90 uppercase tracking-wider">
                Today
              </div>
            </div>
          </div>
        </div>

        {/* Compact Session Header */}
        <Card className="w-full bg-card/50 backdrop-blur-xl border-border">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  onClick={handleBackToSessions}
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg sm:text-xl text-foreground truncate">{selectedSession.event.name}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground truncate">
                    {selectedSession.name}
                  </CardDescription>
                </div>
              </div>
              <Badge 
                variant={selectedSession.isActive ? 'default' : 'secondary'}
                className={selectedSession.isActive 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 backdrop-blur-sm' 
                  : 'bg-white/10 text-white/60 border-white/20'
                }
              >
                {selectedSession.isActive ? (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                {selectedSession.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            
            {/* Input Mode Toggle */}
            <div className="mt-4 flex items-center justify-center">
              <div className="flex items-center gap-3 bg-muted rounded-xl p-1">
                <button
                  onClick={() => setInputMode('qr')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    inputMode === 'qr'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Scan className="h-4 w-4" />
                  QR Scan
                </button>
                <button
                  onClick={() => setInputMode('manual')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    inputMode === 'manual'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Keyboard className="h-4 w-4" />
                  Manual
                </button>
              </div>
            </div>

            {/* Compact Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {new Date(selectedSession.timeInStart).toLocaleDateString('en-PH', {
                    timeZone: 'Asia/Manila',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {new Date(selectedSession.timeInStart).toLocaleTimeString('en-PH', {
                    timeZone: 'Asia/Manila',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
              {selectedSession.event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{selectedSession.event.location}</span>
                </div>
              )}
            </div>
            
            {/* Mobile Stats */}
            <div className="mt-3 p-2 bg-muted border border-border rounded-lg sm:hidden">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground font-medium">Scanned</span>
                </div>
                <span className="text-foreground font-semibold">{attendanceStats.totalScanned}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unified Scanner Interface */}
        <Card className="w-full bg-card border-border shadow-lg">
          <CardContent className="p-4 sm:p-6">
            {inputMode === 'qr' ? (
              <QRScanner
                sessionId={selectedSession.id}
                eventId={selectedSession.eventId}
                onCleanup={handleScannerCleanup}
                onScanningStateChange={handleScanningStateChange}
                onScan={async (qrData, updateScanResult) => {
                  console.log('🔍 Processing scanned QR data:', qrData);
                  
                  try {
                    console.log('📍 Step 1: Parsing QR data...');
                    let studentId: string;
                    let studentData: Record<string, unknown> = {};

                    // Parse the QR data - handle both JSON and plain text
                    try {
                      const parsed = JSON.parse(qrData);
                      // Check if it's actually a JSON object with studentId property
                      if (typeof parsed === 'object' && parsed !== null && parsed.studentId) {
                        studentId = parsed.studentId;
                        studentData = parsed;
                        console.log('✅ Parsed as JSON object:', studentData);
                      } else {
                        // Parsed successfully but it's not a student object (e.g., just a number)
                        console.log('📝 Parsed value is not a student object, treating QR as plain student ID');
                        studentId = qrData.trim();
                      }
                    } catch {
                      // Plain text QR code (just the student ID)
                      console.log('📝 JSON parse failed, treating as plain text student ID');
                      studentId = qrData.trim();
                    }
                    
                    console.log('🔍 Final studentId value:', studentId);
                    console.log('🔍 studentId truthy check:', !!studentId);
                    
                    if (!studentId) {
                      console.error('❌ No student ID found');
                      console.error('❌ studentId value:', studentId);
                      console.error('❌ studentId type:', typeof studentId);
                      throw new Error('No student ID found in QR code');
                    }

                    console.log('📍 Step 2: Student ID validated:', studentId);

                    // Determine scan type based on current time and session windows
                    console.log('📍 Step 2.5: Determining scan type...');
                    const currentTime = new Date();
                    const sessionStart = new Date(selectedSession.timeInStart);
                    const sessionEnd = new Date(selectedSession.timeInEnd);
                    const timeOutStart = selectedSession.timeOutStart ? new Date(selectedSession.timeOutStart) : null;
                    const timeOutEnd = selectedSession.timeOutEnd ? new Date(selectedSession.timeOutEnd) : null;

                    let scanType = 'time_in'; // Default to time_in
                    
                    // Check if we're in the time-out window
                    if (timeOutStart && timeOutEnd && currentTime >= timeOutStart && currentTime <= timeOutEnd) {
                      scanType = 'time_out';
                      console.log('🕐 Determined scan type: time_out (within timeout window)');
                    } else if (currentTime >= sessionStart && currentTime <= sessionEnd) {
                      scanType = 'time_in';
                      console.log('🕐 Determined scan type: time_in (within time-in window)');
                    } else {
                      console.log('🕐 Determined scan type: time_in (default - outside windows)');
                    }

                    // Show processing toast
                    toast.loading('Processing scan...', {
                      description: `Recording ${scanType === 'time_in' ? 'Time-In' : 'Time-Out'} for ${studentId}`,
                      duration: 0, // Don't auto-dismiss
                      id: 'scan-processing', // Use ID to update the same toast
                    });

                    // Record attendance via API
                    console.log('📍 Step 3: Sending attendance request...');
                    console.log('📤 Request data:', {
                      sessionId: selectedSession.id,
                      eventId: selectedSession.eventId,
                      studentId: studentId,
                      scanType: scanType,
                    });

                    const response = await fetch('/api/organizer/attendance', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        sessionId: selectedSession.id,
                        eventId: selectedSession.eventId,
                        studentId: studentId,
                        scanType: scanType,
                      }),
                    });

                    console.log('📍 Step 4: Fetch completed');
                    console.log('📥 Response status:', response.status, response.statusText);
                    console.log('📥 Request details:', {
                      sessionId: selectedSession.id,
                      eventId: selectedSession.eventId,
                      studentId: studentId,
                      scanType: 'time_in'
                    });

                    // Handle duplicate attendance (409 Conflict)
                    if (response.status === 409) {
                      console.log('⚠️ Duplicate scan detected');
                      const errorData = await response.json();
                      console.log('🔍 API Response for duplicate:', errorData);
                      
                      // Dismiss processing toast
                      toast.dismiss('scan-processing');
                      
                      // Use student information from API response instead of QR data
                      const studentInfo = errorData.student || {};
                      console.log('🔍 Student info from API:', studentInfo);
                      
                      // Update scanner display to show the student with duplicate flag
                      updateScanResult({
                        firstName: studentInfo.firstName || 'Student',
                        lastName: studentInfo.lastName || studentId,
                        studentIdNumber: studentInfo.studentIdNumber || studentId,
                        isDuplicate: true,
                      });
                      console.log('🔍 Updated scan result with:', {
                        firstName: studentInfo.firstName || 'Student',
                        lastName: studentInfo.lastName || studentId,
                        studentIdNumber: studentInfo.studentIdNumber || studentId,
                        isDuplicate: true,
                      });
                      
                      // Show warning toast (orange/yellow color)
                      toast.warning('Already Recorded', {
                        description: errorData.message || 'This student has already been recorded for this session',
                        duration: 4000,
                      });
                      
                      // Don't throw error - this is expected behavior
                      console.log('✅ Duplicate scan handled gracefully');
                      return;
                    }

                    if (!response.ok) {
                      console.log('📍 Step 5: Response not OK, parsing error...');
                      const errorData = await response.json();
                      console.error('❌ API Error Response:', errorData);
                      
                      // Dismiss processing toast
                      toast.dismiss('scan-processing');
                      
                      throw new Error(errorData.message || errorData.error || 'Failed to record attendance');
                    }

                    // Dismiss processing toast
                    toast.dismiss('scan-processing');

                    console.log('📍 Step 5: Parsing success response...');
                    const result = await response.json();
                    console.log('📍 Step 6: Response parsed successfully');
                    console.log('✅ Attendance recorded successfully:', result);
                    
                    // Update scanner display with real student data
                    if (result.student) {
                      updateScanResult({
                        firstName: result.student.firstName,
                        lastName: result.student.lastName,
                        studentIdNumber: result.student.studentIdNumber,
                        isDuplicate: false, // Explicitly mark as not duplicate
                      });
                    } else {
                      // If no student data in response, use QR data
                      updateScanResult({
                        firstName: studentData.firstName as string || 'Student',
                        lastName: studentData.lastName as string || studentId,
                        studentIdNumber: studentData.studentIdNumber as string || studentId,
                        isDuplicate: false,
                      });
                    }
                    
                    // Update attendance stats with data from API response
                    handleAttendanceRecorded();

                    // Show success toast with actual student name and scan type
                    if (result.student?.firstName && result.student?.lastName) {
                      const scanTypeText = scanType === 'time_in' ? 'Time-In' : 'Time-Out';
                      toast.success(`✅ Successfully ${scanTypeText}!`, {
                        description: `${result.student.firstName} ${result.student.lastName} - ${result.student.studentIdNumber}`,
                        duration: 4000,
                      });
                    }

                  } catch (error) {
                    console.error('❌ Error recording attendance:', error);
                    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                    
                    // Dismiss processing toast
                    toast.dismiss('scan-processing');
                    
                    throw error; // Re-throw so the scanner can handle it
                  }
                }}
                onError={(error) => {
                  console.error('Scanner error:', error);
                  toast.error('Scanner Error', { description: error });
                }}
              />
            ) : (
              <ManualInput
                sessionId={selectedSession.id}
                eventId={selectedSession.eventId}
                onScan={async (studentIdNumber, updateScanResult) => {
                  console.log('🔍 Processing manual input:', studentIdNumber);
                  
                  try {
                    console.log('📍 Step 1: Validating student ID number:', studentIdNumber);
                    
                    if (!studentIdNumber.trim()) {
                      console.error('❌ No student ID number provided');
                      toast.error('Invalid Input', {
                        description: 'Please enter a student ID number'
                      });
                      throw new Error('No student ID number provided');
                    }

                    console.log('📍 Step 2: Student ID number validated:', studentIdNumber);

                    // Determine scan type based on current time and session windows
                    console.log('📍 Step 2.5: Determining scan type...');
                    const currentTime = new Date();
                    const sessionStart = new Date(selectedSession.timeInStart);
                    const sessionEnd = new Date(selectedSession.timeInEnd);
                    const timeOutStart = selectedSession.timeOutStart ? new Date(selectedSession.timeOutStart) : null;
                    const timeOutEnd = selectedSession.timeOutEnd ? new Date(selectedSession.timeOutEnd) : null;

                    let scanType = 'time_in'; // Default to time_in
                    
                    // Check if we're in the time-out window
                    if (timeOutStart && timeOutEnd && currentTime >= timeOutStart && currentTime <= timeOutEnd) {
                      scanType = 'time_out';
                      console.log('🕐 Determined scan type: time_out (within timeout window)');
                    } else if (currentTime >= sessionStart && currentTime <= sessionEnd) {
                      scanType = 'time_in';
                      console.log('🕐 Determined scan type: time_in (within time-in window)');
                    } else {
                      console.log('🕐 Determined scan type: time_in (default - outside windows)');
                    }

                    // Show processing toast
                    toast.loading('Processing scan...', {
                      description: `Recording ${scanType === 'time_in' ? 'Time-In' : 'Time-Out'} for ${studentIdNumber.trim()}`,
                      duration: 0, // Don't auto-dismiss
                      id: 'manual-scan-processing', // Use different ID for manual input
                    });

                    // Record attendance via API
                    console.log('📍 Step 3: Sending attendance request...');
                    console.log('📤 Request data:', {
                      sessionId: selectedSession.id,
                      eventId: selectedSession.eventId,
                      studentId: studentIdNumber.trim(),
                      scanType: scanType,
                    });

                    const response = await fetch('/api/organizer/attendance', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        sessionId: selectedSession.id,
                        eventId: selectedSession.eventId,
                        studentId: studentIdNumber.trim(),
                        scanType: scanType,
                      }),
                    });

                    console.log('📍 Step 4: Fetch completed');
                    console.log('📥 Response status:', response.status, response.statusText);

                    // Handle duplicate attendance (409 Conflict)
                    if (response.status === 409) {
                      console.log('⚠️ Duplicate manual input detected');
                      const errorData = await response.json();
                      console.log('🔍 API Response for duplicate:', errorData);
                      
                      // Dismiss processing toast
                      toast.dismiss('manual-scan-processing');
                      
                      // Use student information from API response
                      const studentInfo = errorData.student || {};
                      console.log('🔍 Student info from API:', studentInfo);
                      
                      // Update display to show the student with duplicate flag
                      updateScanResult({
                        firstName: studentInfo.firstName || 'Student',
                        lastName: studentInfo.lastName || studentIdNumber.trim(),
                        studentIdNumber: studentInfo.studentIdNumber || studentIdNumber.trim(),
                        isDuplicate: true,
                      });
                      
                      // Show warning toast (orange/yellow color)
                      toast.warning('Already Recorded', {
                        description: errorData.message || 'This student has already been recorded for this session',
                        duration: 4000,
                      });
                      
                      // Don't throw error - this is expected behavior
                      console.log('✅ Duplicate manual input handled gracefully');
                      return;
                    }

                    if (!response.ok) {
                      console.log('📍 Step 5: Response not OK, parsing error...');
                      const errorData = await response.json();
                      console.error('❌ API Error Response:', errorData);
                      
                      // Dismiss processing toast
                      toast.dismiss('manual-scan-processing');
                      
                      throw new Error(errorData.message || errorData.error || 'Failed to record attendance');
                    }

                    // Dismiss processing toast
                    toast.dismiss('manual-scan-processing');

                    console.log('📍 Step 5: Parsing success response...');
                    const result = await response.json();
                    console.log('📍 Step 6: Response parsed successfully');
                    console.log('✅ Attendance recorded successfully:', result);
                    
                    // Update display with real student data
                    if (result.student) {
                      updateScanResult({
                        firstName: result.student.firstName,
                        lastName: result.student.lastName,
                        studentIdNumber: result.student.studentIdNumber,
                        isDuplicate: false, // Explicitly mark as not duplicate
                      });
                    } else {
                      // If no student data in response, use input data
                      updateScanResult({
                        firstName: 'Student',
                        lastName: '',
                        studentIdNumber: studentIdNumber.trim(),
                        isDuplicate: false,
                      });
                    }
                    
                    // Update attendance stats with data from API response
                    handleAttendanceRecorded();

                    // Show success toast with actual student name and scan type
                    if (result.student?.firstName && result.student?.lastName) {
                      const scanTypeText = scanType === 'time_in' ? 'Time-In' : 'Time-Out';
                      toast.success(`✅ Successfully ${scanTypeText}!`, {
                        description: `${result.student.firstName} ${result.student.lastName} - ${result.student.studentIdNumber}`,
                        duration: 4000,
                      });
                    }

                  } catch (error) {
                    console.error('❌ Error recording attendance:', error);
                    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                    const errorMsg = error instanceof Error ? error.message : 'Failed to record attendance';
                    
                    // Dismiss processing toast
                    toast.dismiss('manual-scan-processing');
                    
                    toast.error('Recording Failed', {
                      description: errorMsg
                    });
                    throw error; // Re-throw so the manual input can handle it
                  }
                }}
                onError={(error) => {
                  console.error('Manual input error:', error);
                  toast.error('Input Error', { description: error });
                }}
                onScanningStateChange={handleScanningStateChange}
              />
            )}
          </CardContent>
        </Card>
        </div>

        {/* Leave Confirmation Dialog */}
        <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Camera className="h-5 w-5" />
                Stop Scanning?
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                You are currently scanning QR codes. If you leave now, the scanner will be stopped and you&apos;ll lose your current scanning session.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleCancelLeave}
                className="border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Continue Scanning
              </Button>
              <Button
                onClick={handleConfirmLeave}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                Stop & Leave
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Session Selection Mode
  return (
    <>
      <div className="space-y-6">
        <Card className="w-full bg-card/50 backdrop-blur-xl border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl sm:text-3xl text-gray-900 dark:text-gray-100">Select a Session</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Choose an active session to start scanning QR codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SessionSelector
              onSessionSelect={handleSessionSelect}
            />
          </CardContent>
        </Card>
      </div>

      {/* Leave Confirmation Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Camera className="h-5 w-5" />
              Stop Scanning?
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              You are currently scanning QR codes. If you leave now, the scanner will be stopped and you&apos;ll lose your current scanning session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelLeave}
              className="border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Continue Scanning
            </Button>
            <Button
              onClick={handleConfirmLeave}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Stop & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ScanPage;
