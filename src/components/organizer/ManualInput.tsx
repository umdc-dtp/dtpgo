'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Hash, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Keyboard,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

interface ManualInputProps {
  sessionId: string;
  eventId: string;
  onScan: (qrData: string, updateResult: (data: Partial<ScanResult>) => void) => Promise<void>;
  onError?: (error: string) => void;
  onScanningStateChange?: (isScanning: boolean) => void;
}

interface ScanResult {
  studentId: string;
  studentIdNumber: string;
  firstName: string;
  lastName: string;
  timestamp: string;
  isDuplicate?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export function ManualInput({ onScan }: ManualInputProps) {
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (dialogTimerRef.current) {
        clearTimeout(dialogTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isProcessing) {
      return;
    }
    
    if (!studentIdNumber.trim()) {
      toast.error('Please enter a student ID number');
      return;
    }

    setIsProcessing(true);
    
    try {
      console.log('🔍 Processing manual input:', studentIdNumber.trim());
      
      // Show processing state
      setLastScanResult({
        studentId: studentIdNumber.trim(),
        studentIdNumber: studentIdNumber.trim(),
        firstName: 'Processing',
        lastName: '...',
        timestamp: new Date().toISOString()
      });
      setShowResultDialog(true);

      // Call the same onScan callback that QR scanner uses
      let finalResult: Partial<ScanResult> | null = null;
      
      await onScan(studentIdNumber.trim(), (updatedData) => {
        finalResult = updatedData;
      });

      console.log('✅ Manual input processed successfully');

      if (!finalResult) {
        throw new Error('Attendance response did not confirm a result');
      }
      
      // Update with the final result
      if (finalResult) {
        const fr = finalResult as Partial<ScanResult>;
        const completed: ScanResult = {
          studentId: fr.studentId ?? studentIdNumber.trim(),
          studentIdNumber: fr.studentIdNumber ?? studentIdNumber.trim(),
          firstName: fr.firstName ?? 'Student',
          lastName: fr.lastName ?? '',
          timestamp: new Date().toISOString(),
          isDuplicate: fr.isDuplicate,
          isError: fr.isError,
          errorMessage: fr.errorMessage,
        };
        
        if (completed.isDuplicate) {
          console.log('🟡 Duplicate manual input detected');
          setLastScanResult({ ...completed, isDuplicate: true });
        } else {
          console.log('🟢 Success manual input');
          setLastScanResult(completed);
        }
      }

      // Auto-dismiss dialog after 3 seconds
      if (dialogTimerRef.current) {
        clearTimeout(dialogTimerRef.current);
      }
      dialogTimerRef.current = setTimeout(() => {
        setShowResultDialog(false);
      }, 3000);

      // Clear input for next entry
      setStudentIdNumber('');
      
      // Focus input again for next entry
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);

    } catch (error) {
      console.error('❌ Error processing manual input:', error);
      
      // Show error dialog
      setLastScanResult({
        studentId: studentIdNumber.trim(),
        studentIdNumber: studentIdNumber.trim(),
        firstName: 'Error',
        lastName: '',
        timestamp: new Date().toISOString(),
        isError: true,
        errorMessage: error instanceof Error ? error.message : 'Failed to record attendance'
      });
      
      setShowResultDialog(true);
      
      // Auto-dismiss error dialog after 4 seconds
      if (dialogTimerRef.current) {
        clearTimeout(dialogTimerRef.current);
      }
      dialogTimerRef.current = setTimeout(() => {
        setShowResultDialog(false);
      }, 4000);
      
      toast.error('Recording Failed', {
        description: error instanceof Error ? error.message : 'Failed to record attendance'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Success Result Dialog - Same as QR Scanner */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        showResultDialog ? 'block' : 'hidden'
      }`}>
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowResultDialog(false)} />
        <div className={`relative max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden rounded-3xl backdrop-blur-xl border-2 ${
          lastScanResult?.isError
            ? 'bg-gradient-to-br from-red-500/30 to-red-600/30 border-red-500/50'
            : lastScanResult?.isDuplicate 
            ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 border-amber-500/50' 
            : isProcessing
            ? 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border-blue-500/50'
            : 'bg-gradient-to-br from-emerald-500/30 to-green-500/30 border-emerald-500/50'
        } shadow-2xl ${
          lastScanResult?.isError 
            ? 'shadow-red-500/30' 
            : lastScanResult?.isDuplicate 
              ? 'shadow-amber-500/30' 
              : 'shadow-emerald-500/30'
        } animate-in zoom-in-95 duration-300 max-w-md w-full`}>
          
          {/* Animated background sparkles */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-0 left-1/4 w-2 h-2 ${
              lastScanResult?.isError 
                ? 'bg-red-400' 
                : lastScanResult?.isDuplicate 
                  ? 'bg-amber-400' 
                  : 'bg-emerald-400'
            } rounded-full animate-ping`}></div>
            <div className={`absolute top-1/4 right-1/4 w-1 h-1 ${
              lastScanResult?.isError 
                ? 'bg-red-500' 
                : lastScanResult?.isDuplicate 
                  ? 'bg-orange-400' 
                  : 'bg-green-400'
            } rounded-full animate-ping delay-75`}></div>
            <div className={`absolute bottom-1/4 left-1/3 w-1.5 h-1.5 ${
              lastScanResult?.isError 
                ? 'bg-red-300' 
                : lastScanResult?.isDuplicate 
                  ? 'bg-amber-300' 
                  : 'bg-emerald-300'
            } rounded-full animate-ping delay-150`}></div>
          </div>

          <div className="relative p-8 text-center space-y-6">
            {/* Icon with glow */}
            <div className="relative inline-block">
              <div className={`absolute inset-0 ${
                lastScanResult?.isError 
                  ? 'bg-red-500' 
                  : lastScanResult?.isDuplicate 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
              } rounded-full blur-2xl opacity-50 animate-pulse`}></div>
              <div className={`relative p-6 rounded-full ${
                lastScanResult?.isError 
                  ? 'bg-gradient-to-br from-red-500 to-red-600' 
                  : lastScanResult?.isDuplicate 
                  ? 'bg-gradient-to-br from-amber-500 to-orange-500' 
                  : 'bg-gradient-to-br from-emerald-500 to-green-500'
              }`}>
                {isProcessing ? (
                  <Loader2 className="h-16 w-16 animate-spin text-white" />
                ) : lastScanResult?.isError ? (
                  <AlertCircle className="h-16 w-16 text-white" />
                ) : lastScanResult?.isDuplicate ? (
                  <CheckCircle className="h-16 w-16 text-white" />
                ) : (
                  <CheckCircle className="h-16 w-16 text-white" />
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 className={`text-3xl font-bold mb-2 ${
                lastScanResult?.isError 
                  ? 'text-red-100' 
                  : lastScanResult?.isDuplicate 
                    ? 'text-amber-100' 
                    : 'text-emerald-100'
              }`}>
                {isProcessing
                  ? 'Processing...'
                  : lastScanResult?.isError
                  ? 'Error!'
                  : lastScanResult?.isDuplicate 
                    ? 'Already Recorded!' 
                    : 'Success!'}
              </h2>
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2 text-blue-100">
                    <span className="text-sm">Verifying attendance...</span>
                  </div>
                ) : lastScanResult?.isError ? (
                <div className="flex items-center justify-center gap-2 text-red-200/80">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Input Failed</span>
                  <AlertCircle className="h-4 w-4" />
                </div>
              ) : !lastScanResult?.isDuplicate && (
                <div className="flex items-center justify-center gap-2 text-emerald-200/80">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-sm">Attendance Recorded</span>
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
            </div>

            {/* Student Info */}
            <div className="space-y-3">
              {lastScanResult?.isError ? (
                <div className="flex items-center justify-center gap-3 text-white">
                  <AlertCircle className="h-6 w-6 text-white/80" />
                  <span className="font-bold text-2xl">
                    {lastScanResult?.errorMessage || 'Input Error'}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3 text-white">
                    <User className="h-6 w-6 text-white/80" />
                    <span className="font-bold text-2xl">
                      {lastScanResult?.firstName} {lastScanResult?.lastName}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-center gap-3 text-white/90">
                    <Hash className="h-5 w-5 text-white/70" />
                    <span className="font-mono text-xl">
                      {lastScanResult?.studentIdNumber}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Timestamp */}
            <div className={`text-sm ${
              lastScanResult?.isError 
                ? 'text-red-200/60' 
                : lastScanResult?.isDuplicate 
                  ? 'text-amber-200/60' 
                  : 'text-emerald-200/60'
            }`}>
              {lastScanResult?.isError 
                ? `Error occurred at ${lastScanResult ? new Date(lastScanResult.timestamp).toLocaleTimeString() : ''}`
                : lastScanResult?.isDuplicate 
                ? `Previously recorded at ${lastScanResult ? new Date(lastScanResult.timestamp).toLocaleTimeString() : ''}`
                : `Recorded at ${lastScanResult ? new Date(lastScanResult.timestamp).toLocaleTimeString() : ''}`
              }
            </div>

            {/* Auto-dismiss indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
                <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-pulse"></div>
                <span>Auto-closing in 3 seconds</span>
              </div>
              <button
                onClick={() => setShowResultDialog(false)}
                className="text-white/30 hover:text-white/60 text-xs underline transition-colors"
              >
                Tap to close now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Input Form */}
      <div className="w-full">
        <div className="text-center p-6">
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full blur-2xl opacity-50 animate-pulse"></div>
            <div className="relative bg-gradient-to-r from-yellow-500 to-amber-500 rounded-full p-4 shadow-2xl">
              <Keyboard className="h-8 w-8 text-white" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Manual Entry</h3>
          <p className="text-muted-foreground">
            Enter student ID number manually when QR code is not available
          </p>
        </div>
        <div className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="studentIdNumber" className="text-sm font-medium text-foreground">
                Student ID Number
              </label>
              <Input
                ref={inputRef}
                id="studentIdNumber"
                type="text"
                value={studentIdNumber}
                onChange={(e) => setStudentIdNumber(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter student ID number..."
                disabled={isProcessing}
                className="text-center text-base sm:text-lg font-mono bg-background border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 h-12 sm:h-14"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>

            <Button
              type="submit"
              disabled={!studentIdNumber.trim() || isProcessing}
              className="w-full h-12 sm:h-14 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-semibold text-sm sm:text-base rounded-xl shadow-lg shadow-yellow-500/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Hash className="mr-2 h-5 w-5" />
                  Record Attendance
                </>
              )}
            </Button>
          </form>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/40">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/10 animate-pulse"></div>
              <Alert className="border-0 bg-transparent relative">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-yellow-500 rounded-full blur-lg opacity-50 animate-ping"></div>
                    <Loader2 className="h-6 w-6 text-yellow-600 relative animate-spin" />
                  </div>
                  <AlertDescription className="text-yellow-800 font-medium text-base">
                    Processing student ID...
                  </AlertDescription>
                </div>
              </Alert>
            </div>
          )}

          {/* Usage Tips */}
          <div className="mt-6 p-4 rounded-xl bg-muted border border-border backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Keyboard className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-2">Manual Entry Tips</h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                    Enter the student&apos;s ID number (not the CUID)
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                    Press Enter or click &quot;Record Attendance&quot; to submit
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                    Input will clear automatically after successful recording
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
