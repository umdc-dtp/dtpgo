'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRScanner } from './QRScanner';
import { ManualInput } from './ManualInput';
import { AttendanceQueue } from './AttendanceQueue';
import { useAttendanceQueue } from './useAttendanceQueue';
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
  const [displayMode, setDisplayMode] = useState<'qr' | 'manual'>('qr');
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [attendanceStats, setAttendanceStats] = useState({
    totalScanned: 0,
    lastScanTime: null as Date | null,
  });
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const [hasPendingAttendance, setHasPendingAttendance] = useState(false);
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
      if (isScanningActive || hasPendingAttendance) {
        e.preventDefault();
        e.returnValue = 'Attendance processing may still be in progress.';
        return 'Attendance processing may still be in progress.';
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isScanningActive || hasPendingAttendance) {
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
  }, [isScanningActive, hasPendingAttendance]);

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
    if (isScanningActive || hasPendingAttendance) {
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

  useEffect(() => {
    if (inputMode === displayMode) return;
    const timeout = window.setTimeout(() => setDisplayMode(inputMode), 120);
    return () => window.clearTimeout(timeout);
  }, [inputMode, displayMode]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => setContentHeight(content.getBoundingClientRect().height));
    observer.observe(content);
    return () => observer.disconnect();
  }, [displayMode, scanMode]);

  const handleAttendanceRecorded = () => {
    setAttendanceStats(prev => ({
      totalScanned: prev.totalScanned + 1,
      lastScanTime: new Date(),
    }));
    
  };

  const { jobs, enqueue, retry, setStudentDirectory } = useAttendanceQueue(handleAttendanceRecorded);

  useEffect(() => {
    setHasPendingAttendance(jobs.some(job => job.status === 'queued' || job.status === 'processing'));
  }, [jobs]);

  useEffect(() => {
    if (scanMode !== 'scan' || !selectedSession) return;
    const controller = new AbortController();
    const warm = () => {
      void fetch(`/api/organizer/attendance?warmup=students&sessionId=${encodeURIComponent(selectedSession.id)}`, { signal: controller.signal })
        .then(async response => {
          if (!response.ok) return;
          const data = await response.json();
          if (!controller.signal.aborted && data.complete && Array.isArray(data.students)) {
            setStudentDirectory(data.students);
          }
        })
        .catch(() => { /* The attendance endpoint still has its indexed lookup fallback. */ });
    };
    warm();
    const interval = window.setInterval(warm, 5 * 60_000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [scanMode, selectedSession?.id, setStudentDirectory]);

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
        {/* Compact Session Header */}
        <Card className="w-full bg-card/50 backdrop-blur-xl border-border">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                  onClick={handleBackToSessions}
                  variant="outline"
                  size="sm"
                  className="border-border text-foreground hover:bg-muted flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <CardTitle className="truncate text-base sm:text-lg text-foreground">{selectedSession.event.name}</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground truncate">
                    {selectedSession.name}
                  </CardDescription>
                </div>
              </div>
              <div className="relative flex shrink-0 items-center rounded-xl bg-muted p-1" role="group" aria-label="Attendance input mode">
                <span aria-hidden="true" className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-background shadow-sm transition-transform duration-200 ease-in-out motion-reduce:transition-none ${inputMode === 'manual' ? 'translate-x-full' : ''}`} />
                <button
                  type="button"
                  onClick={() => setInputMode('qr')}
                  aria-pressed={inputMode === 'qr'}
                  className={`relative z-10 flex w-28 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${inputMode === 'qr' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Scan className="h-4 w-4" />
                  QR Scan
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  aria-pressed={inputMode === 'manual'}
                  className={`relative z-10 flex w-28 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${inputMode === 'manual' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Keyboard className="h-4 w-4" />
                  Manual
                </button>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant={selectedSession.isActive ? 'default' : 'secondary'} className={selectedSession.isActive ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : ''}>
                  {selectedSession.isActive ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
                  {selectedSession.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <Badge variant="secondary" className="whitespace-nowrap">{attendanceStats.totalScanned} recorded here</Badge>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border pt-3 text-xs sm:text-sm">
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
            
          </CardContent>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <Card className="min-w-0 w-full bg-card border-border shadow-lg">
          <CardContent className="p-4 sm:p-5">
            <div className="overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none" style={contentHeight === null ? undefined : { height: contentHeight }}>
              <div ref={contentRef} className={`transition-opacity duration-150 motion-reduce:transition-none ${inputMode === displayMode ? 'opacity-100' : 'opacity-0'}`}>
            {displayMode === 'qr' ? (
              <QRScanner
                onCapture={raw => enqueue(raw, 'qr', selectedSession)}
                onScanningStateChange={handleScanningStateChange}
                onCleanup={handleScannerCleanup}
              />
            ) : (
              <ManualInput onCapture={studentId => enqueue(studentId, 'manual', selectedSession)} />
            )}
              </div>
            </div>
          </CardContent>
        </Card>
        <AttendanceQueue jobs={jobs.filter(job => job.sessionId === selectedSession.id)} onRetry={retry} />
        </div>
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
                Leaving will stop the camera. Wait for pending attendance entries to finish so you can see their results.
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
                disabled={hasPendingAttendance}
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
              Leaving will stop the camera. Wait for pending attendance entries to finish so you can see their results.
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
              disabled={hasPendingAttendance}
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
