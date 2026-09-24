'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Camera, X, CheckCircle, User, Hash, Zap, Scan, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QRScannerProps {
  sessionId: string;
  eventId: string;
  onScan: (qrData: string, updateResult: (data: Partial<ScanResult>) => void) => Promise<void>;
  onError?: (error: string) => void;
  onCleanup?: () => void;
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

export function QRScanner({ onScan, onError, onCleanup, onScanningStateChange }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanAnimation, setScanAnimation] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef(true);
  const successAudioRef = useRef<HTMLAudioElement | null>(null);
  const dialogTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUpRef = useRef(false);
  const scanStateRef = useRef(new Map<string, { processing: boolean; lastProcessedAt: number }>());
  const activeScanCountRef = useRef(0);

  // Initialize success sound
  useEffect(() => {
    successAudioRef.current = new Audio();
    successAudioRef.current.src = 'data:audio/wav;base64,UklGRhIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==';
    successAudioRef.current.volume = 0.3;

    return () => {
      if (successAudioRef.current) {
        successAudioRef.current = null;
      }
    };
  }, []);

  // Detect device type for camera mirroring
  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
                            (window.innerWidth <= 768) ||
                            ('ontouchstart' in window);
      setIsMobile(isMobileDevice);
    };

    detectDevice();
    
    // Re-detect on resize
    const handleResize = () => detectDevice();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize scanner
  useEffect(() => {
    isMountedRef.current = true;

    // Get available cameras
    Html5Qrcode.getCameras().then(cameras => {
      if (cameras && cameras.length > 0) {
        // Prefer back camera
        const backCamera = cameras.find(cam => 
          cam.label.toLowerCase().includes('back') || 
          cam.label.toLowerCase().includes('rear') ||
          cam.label.toLowerCase().includes('environment')
        );
        setCameraId(backCamera?.id || cameras[0].id);
        console.log('📷 Found cameras:', cameras.length, 'Using:', backCamera?.label || cameras[0].label);
      }
    }).catch(err => {
      console.error('Error getting cameras:', err);
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset scanner state when component mounts (for mode switching)
  useEffect(() => {
    // Reset all scanner-related state when component mounts
    setIsScanning(false);
    setIsProcessing(false);
    setScanAnimation(false);
    setShowResultDialog(false);
    setLastScanResult(null);
    setIsStopping(false);
    scanStateRef.current.clear();
    activeScanCountRef.current = 0;
    
    // Clear any existing scanner instance
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner on mount:', err);
      }
      scannerRef.current = null;
    }
    
    console.log('🔄 QR Scanner component mounted - state reset');
  }, []);

  const startScanning = useCallback(async () => {
    if (!cameraId) {
      toast.error('No camera available');
      return;
    }

    try {
      // Create scanner instance if not exists
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader');
      }

      console.log('🎬 Starting QR scanner...');

      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: function(viewfinderWidth, viewfinderHeight) {
            console.log('📐 Viewfinder dimensions:', { viewfinderWidth, viewfinderHeight, isMobile });
            
            if (isMobile) {
              // Mobile: Optimize for mobile screen sizes
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              const maxEdge = Math.max(viewfinderWidth, viewfinderHeight);
              
              // Use different sizing based on screen orientation and size
              let qrboxSize;
              if (maxEdge > minEdge * 1.5) {
                // Landscape orientation - use smaller percentage
                qrboxSize = Math.floor(minEdge * 0.6);
              } else {
                // Portrait orientation - use larger percentage
                qrboxSize = Math.floor(minEdge * 0.75);
              }
              
              // Ensure minimum size for usability
              qrboxSize = Math.max(qrboxSize, 200);
              
              console.log('📱 Mobile qrbox size:', qrboxSize, 'orientation:', maxEdge > minEdge * 1.5 ? 'landscape' : 'portrait');
              return {
                width: qrboxSize,
                height: qrboxSize
              };
            } else {
              // Desktop: Create a much larger scanning area to reduce zoom effect
              const maxWidth = Math.min(viewfinderWidth * 0.8, 600);
              const maxHeight = Math.min(viewfinderHeight * 0.8, 800);
              
              // Use 1:1 aspect ratio (square) for better QR scanning
              const scanningAspectRatio = 1.0;
              let width = maxWidth;
              let height = width / scanningAspectRatio;
              
              // If height exceeds max, adjust
              if (height > maxHeight) {
                height = maxHeight;
                width = height * scanningAspectRatio;
              }
              
              const result = {
                width: Math.floor(width),
                height: Math.floor(height)
              };
              
              console.log('🖥️ Desktop qrbox result:', result);
              console.log('🖥️ Desktop viewfinder usage:', {
                widthUsage: `${Math.floor((result.width / viewfinderWidth) * 100)}%`,
                heightUsage: `${Math.floor((result.height / viewfinderHeight) * 100)}%`
              });
              
              return result;
            }
          },
          aspectRatio: isMobile ? 1.0 : 1.0, // Square for both, but mobile gets different video constraints
          videoConstraints: isMobile ? {
            // Mobile camera constraints - optimized for mobile devices
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            facingMode: "environment" // Use back camera on mobile
          } : {
            // Desktop camera constraints to reduce zoom
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            // No facingMode for desktop
          },
        },
        async (decodedText) => {
          // Deduplicate each QR independently so different students can scan concurrently.
          const scanKey = decodedText.trim();
          if (!scanKey) return;
          const now = Date.now();
          const scanState = scanStateRef.current.get(scanKey);
          if (scanState?.processing || (scanState && now - scanState.lastProcessedAt < 2000)) {
            console.log('⏳ Debouncing scan...');
            return;
          }
          scanStateRef.current.set(scanKey, { processing: true, lastProcessedAt: now });
          activeScanCountRef.current += 1;

          console.log('✅ QR Code detected:', decodedText);
          setScanAnimation(true);
          setIsProcessing(true);

          setTimeout(() => setScanAnimation(false), 1000);

          try {
            let studentData: {
              studentId: string;
              studentIdNumber?: string;
              firstName?: string;
              lastName?: string;
            };

            // Parse QR data
            try {
              const parsed = JSON.parse(decodedText);
              studentData = parsed;
            } catch {
              console.log('📝 Plain text QR code detected, treating as student ID:', decodedText);
              studentData = {
                studentId: decodedText.trim(),
                studentIdNumber: decodedText.trim(),
              };
            }

              // Call the onScan callback first (this does the database validation)
              try {
                let finalResult: Partial<ScanResult> | null = null;
                
                // Show processing state
            setLastScanResult({
              studentId: studentData.studentId,
              studentIdNumber: studentData.studentIdNumber || studentData.studentId,
                  firstName: 'Processing',
                  lastName: '...',
              timestamp: new Date().toISOString()
            });
            setShowResultDialog(true);
                
                // Wait for API response
                await onScan(decodedText, (updatedData) => {
                  finalResult = updatedData;
                });
                console.log('✅ onScan callback completed successfully');

                if (!finalResult) {
                  throw new Error('Attendance response did not confirm a result');
                }
                const confirmedResult = finalResult as Partial<ScanResult>;
                
                // Now update with the final result
                if (finalResult) {
                  const fr = finalResult as Partial<ScanResult>;
                  const completed: ScanResult = {
                    studentId: fr.studentId ?? studentData.studentId,
                    studentIdNumber: fr.studentIdNumber ?? (studentData.studentIdNumber || studentData.studentId),
                    firstName: fr.firstName ?? 'Student',
                    lastName: fr.lastName ?? '',
                    timestamp: new Date().toISOString(),
                    isDuplicate: fr.isDuplicate,
                    isError: fr.isError,
                    errorMessage: fr.errorMessage,
                  };
                  if (completed.isDuplicate) {
                    console.log('🟡 Duplicate scan detected - showing yellow dialog');
                    console.log('🔍 Using finalResult data:', completed);
                    // Show duplicate dialog (yellow/orange) using the data from API response
                    setLastScanResult({ ...completed, isDuplicate: true });
                  } else {
                    console.log('🟢 Success scan - showing green dialog');
                    console.log('🔍 Using finalResult data for success:', completed);
                    // Show success dialog (green) using the data from API response
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

              // Play success sound
              if (successAudioRef.current && !confirmedResult.isError && !confirmedResult.isDuplicate) {
                successAudioRef.current.currentTime = 0;
                successAudioRef.current.play().catch(err => console.warn('Could not play sound:', err));
              }
              
            } catch (callbackErr) {
              console.error('❌ Error in onScan callback:', callbackErr);
              
              // Show error dialog instead of success
              setLastScanResult({
                studentId: studentData.studentId,
                studentIdNumber: studentData.studentIdNumber || studentData.studentId,
                firstName: 'Error',
                lastName: '',
                timestamp: new Date().toISOString(),
                isError: true,
                errorMessage: callbackErr instanceof Error ? callbackErr.message : 'Failed to record attendance'
              });
              
              // Show error dialog
              setShowResultDialog(true);
              
              // Auto-dismiss error dialog after 4 seconds (longer for errors)
              if (dialogTimerRef.current) {
                clearTimeout(dialogTimerRef.current);
              }
              dialogTimerRef.current = setTimeout(() => {
                setShowResultDialog(false);
              }, 4000);
              
              toast.error('Recording Failed', {
                description: callbackErr instanceof Error ? callbackErr.message : 'Failed to record attendance'
              });
            }

          } catch (err) {
            console.error('❌ Error processing QR data:', err);
            toast.error('Scan Error', {
              description: err instanceof Error ? err.message : 'Failed to process QR code'
            });
          } finally {
            const currentScanState = scanStateRef.current.get(scanKey);
            if (currentScanState) {
              scanStateRef.current.set(scanKey, { ...currentScanState, processing: false });
            }
            activeScanCountRef.current = Math.max(0, activeScanCountRef.current - 1);
            setIsProcessing(activeScanCountRef.current > 0);
            console.log('🔄 Processing state reset to false');
          }
        },
        (errorMessage) => {
          if (!errorMessage.includes('NotFoundException')) {
            console.warn('Scanner error:', errorMessage);
          }
        }
      );

      setIsScanning(true);
      onScanningStateChange?.(true);
      console.log('✅ Scanner started successfully');
    } catch (err) {
      console.error('Error starting scanner:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to start scanner';
      toast.error(errorMsg);
      onError?.(errorMsg);
    }
  }, [cameraId, isMobile, onScan, onError, onScanningStateChange]);

  const stopScanning = useCallback(async () => {
    console.log('🛑 Stop scanner called, isScanning:', isScanning, 'scannerRef exists:', !!scannerRef.current);
    
    setIsStopping(true);
    
    if (!scannerRef.current) {
      console.log('⚠️ No scanner instance to stop');
      setIsScanning(false);
      onScanningStateChange?.(false);
      setIsStopping(false);
      return;
    }

    try {
      // Always try to stop the scanner, regardless of isScanning state
      await scannerRef.current.stop();
      console.log('✅ Scanner stopped successfully');
    } catch (err) {
      console.error('❌ Error stopping scanner:', err);
      // Even if stop fails, we should still update the state
    } finally {
      // Always update state to ensure UI reflects the change
      setIsScanning(false);
      onScanningStateChange?.(false);
      setIsStopping(false);
      console.log('🔄 Scanner state updated to stopped');
    }
  }, [isScanning, onScanningStateChange]);

  // Expose cleanup function to parent component
  const cleanup = useCallback(async () => {
    // Prevent multiple cleanup calls
    if (isCleaningUpRef.current) {
      console.log('🧹 Cleanup already in progress, skipping...');
      return;
    }
    
    isCleaningUpRef.current = true;
    console.log('🧹 Cleaning up QR scanner...');
    
    try {
      // Clear any pending timers
      if (dialogTimerRef.current) {
        clearTimeout(dialogTimerRef.current);
        dialogTimerRef.current = null;
      }
      
      // Stop scanner if running - this is critical to avoid the "Cannot clear while scan is ongoing" error
      if (scannerRef.current) {
        try {
          // Check if scanner is actually running before trying to stop it
          if (isScanning) {
            await scannerRef.current.stop();
            console.log('🛑 Scanner stopped during cleanup');
          }
          
          // Now clear the scanner instance
          scannerRef.current.clear();
          console.log('🧹 Scanner cleared');
        } catch (err) {
          console.error('Error during scanner cleanup:', err);
          // Even if there's an error, we should still try to clear
          try {
            if (scannerRef.current) {
              scannerRef.current.clear();
            }
          } catch (clearErr) {
            console.error('Error clearing scanner after stop failure:', clearErr);
          }
        } finally {
          scannerRef.current = null;
        }
      }
      
      // Reset state
      setIsScanning(false);
      setIsProcessing(false);
      scanStateRef.current.clear();
      activeScanCountRef.current = 0;
      setScanAnimation(false);
      setShowResultDialog(false);
      setLastScanResult(null);
      
      // Notify parent component
      onScanningStateChange?.(false);
      onCleanup?.();
      
      console.log('✅ QR scanner cleanup completed');
    } finally {
      isCleaningUpRef.current = false;
    }
  }, [isScanning, onCleanup, onScanningStateChange]);

  // Expose cleanup function to parent via ref
  useEffect(() => {
    // Store cleanup function in a way that parent can access it
    (window as unknown as { __qrScannerCleanup?: () => Promise<void> }).__qrScannerCleanup = cleanup;
    
    return () => {
      delete (window as unknown as { __qrScannerCleanup?: () => Promise<void> }).__qrScannerCleanup;
    };
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Use a more robust cleanup approach for unmount
      if (scannerRef.current) {
        try {
          // Try to stop first if scanning
          if (isScanning) {
            scannerRef.current.stop().catch(() => {
              // Ignore stop errors during unmount
            });
          }
          // Always try to clear
          scannerRef.current.clear();
        } catch (err) {
          // Ignore cleanup errors during unmount
          console.warn('Cleanup error during unmount (ignored):', err);
        } finally {
          scannerRef.current = null;
        }
      }
      
      // Clear timers
      if (dialogTimerRef.current) {
        clearTimeout(dialogTimerRef.current);
      }
    };
  }, [isScanning]);

  return (
    <div className="space-y-4">
      {/* Success Result Dialog - Celebratory Popup */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-md" showCloseButton={false}>
          {/* Screen reader only title for accessibility */}
          <DialogTitle className="sr-only">
            {lastScanResult?.isError 
              ? 'Error Scan Result' 
              : lastScanResult?.isDuplicate 
                ? 'Duplicate Scan Result' 
                : 'Successful Scan Result'}
          </DialogTitle>
          
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
          } animate-in zoom-in-95 duration-300`}>
            
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
                    <X className="h-16 w-16 text-white" />
                  ) : lastScanResult?.isDuplicate ? (
                    <Zap className="h-16 w-16 text-white" />
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
                    <span className="text-sm">Scan Failed</span>
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
                      {lastScanResult?.errorMessage || 'Scan Error'}
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
                  ? `Previously scanned at ${lastScanResult ? new Date(lastScanResult.timestamp).toLocaleTimeString() : ''}`
                  : `Scanned at ${lastScanResult ? new Date(lastScanResult.timestamp).toLocaleTimeString() : ''}`
                }
              </div>

              {/* Auto-dismiss indicator with tap-to-close hint */}
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
        </DialogContent>
      </Dialog>

      {/* Modern Scanner Styles */}
      <style jsx global>{`
        #qr-reader video {
          ${!isMobile ? 'transform: scaleX(-1) !important;' : ''}
          ${!isMobile ? '-webkit-transform: scaleX(-1) !important;' : ''}
          border-radius: 1rem;
          object-fit: cover;
        }
        
        #qr-reader__dashboard_section_swaplink {
          display: none !important;
        }
        
        /* Clean scanner without shaded region */
        #qr-shaded-region {
          display: none !important;
        }
      `}</style>

      {/* Processing Indicator - Animated */}
      {isProcessing && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-500/20 to-amber-500/20 dark:from-yellow-900/20 dark:to-amber-900/20 border-2 border-yellow-500/40 dark:border-yellow-900/40">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/10 dark:from-yellow-900/10 dark:via-amber-900/10 dark:to-yellow-900/10 animate-pulse"></div>
          <Alert className="border-0 bg-transparent relative">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 dark:bg-yellow-600 rounded-full blur-lg opacity-50 animate-ping"></div>
                <Scan className="h-6 w-6 text-yellow-600 dark:text-yellow-400 relative animate-spin" />
              </div>
              <AlertDescription className="text-yellow-800 dark:text-yellow-300 font-medium text-base">
                Processing QR code...
              </AlertDescription>
            </div>
          </Alert>
        </div>
      )}

      {/* Scanner Container - Premium Look */}
      <div className="relative group">
        <div
          id="qr-reader"
          className={`rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
            isScanning ? 'shadow-yellow-500/50 ring-2 ring-yellow-500/30' : ''
          } ${scanAnimation ? 'scale-[1.02]' : 'scale-100'} ${
            !isMobile ? 'bg-gray-50 dark:bg-gray-800' : ''
          } ${isMobile ? 'w-full' : ''}`}
          style={{ 
            minHeight: isMobile ? '250px' : '300px',
            maxHeight: isMobile ? '400px' : '400px',
            width: isMobile ? '100%' : '400px',
            maxWidth: isMobile ? '100%' : '400px',
            margin: '0 auto',
            aspectRatio: isMobile ? '1/1' : '1/1'
          }}
        />
        {!isScanning && (
          <div className={`absolute inset-0 flex items-center justify-center rounded-2xl backdrop-blur-sm ${
            isMobile 
              ? 'bg-gradient-to-br from-gray-900/95 via-gray-900/95 to-gray-900/95 dark:from-gray-950/95 dark:via-gray-950/95 dark:to-gray-950/95'
              : 'bg-gradient-to-br from-gray-800/90 via-gray-700/90 to-gray-800/90 dark:from-gray-900/90 dark:via-gray-800/90 dark:to-gray-900/90'
          }`}>
            <div className="text-center px-4">
              <div className="relative inline-block mb-8">
                <div className={`absolute inset-0 rounded-full blur-2xl opacity-50 animate-pulse ${
                  isMobile 
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 dark:from-yellow-600 dark:to-amber-600'
                    : 'bg-gradient-to-r from-yellow-400 to-amber-400 dark:from-yellow-500 dark:to-amber-500'
                }`}></div>
                <div className={`relative rounded-full p-6 shadow-2xl ${
                  isMobile 
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 dark:from-yellow-600 dark:to-amber-600'
                    : 'bg-gradient-to-r from-yellow-400 to-amber-400 dark:from-yellow-500 dark:to-amber-500'
                }`}>
                  <Camera className="h-12 w-12 text-white" />
                </div>
              </div>
              <h2 className={`text-xl font-bold mb-2 ${
                isMobile 
                  ? 'text-gray-100 dark:text-gray-100' 
                  : 'text-gray-50 dark:text-gray-50'
              }`}>Ready to Scan</h2>
              <p className={`text-sm ${
                isMobile 
                  ? 'text-gray-400 dark:text-gray-400' 
                  : 'text-gray-300 dark:text-gray-300'
              }`}>
                {isMobile 
                  ? 'Position QR code within the frame' 
                  : 'Position mobile phone screen within the scanning area'
                }
              </p>
              <p className={`text-xs mt-1 ${
                isMobile 
                  ? 'text-gray-500 dark:text-gray-500' 
                  : 'text-gray-400 dark:text-gray-400'
              }`}>Click start to begin scanning</p>
            </div>
          </div>
        )}
        
        {/* Scanning Tips - Elegant */}
        {isScanning && !lastScanResult && !isProcessing && (
          <div className="mt-4 p-4 rounded-xl bg-muted border border-border backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Camera className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-2">
                  {isMobile ? 'Scanning Tips' : 'Mobile Phone Scanning Tips'}
                </h4>
                <ul className="text-xs text-muted-foreground space-y-2">
                  {isMobile ? (
                    <>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        Position QR code within the highlighted frame
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        Hold steady for 1-2 seconds
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        Ensure good lighting for better scanning
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        Position the mobile phone screen within the scanning frame
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        Hold the phone steady and ensure QR code is clearly visible
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        Adjust phone brightness if needed for better scanning
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="w-1.5 h-1.5 bg-yellow-500 dark:bg-yellow-400 rounded-full"></span>
                        The scanning area is optimized for mobile phone screens
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls - Modern Action Buttons */}
      <div className="flex gap-3">
        {!isScanning ? (
          <Button
            onClick={startScanning}
            disabled={!cameraId}
            className="flex-1 h-11 bg-gradient-to-r from-yellow-500 to-amber-500 dark:from-yellow-600 dark:to-amber-600 hover:from-yellow-600 hover:to-amber-600 dark:hover:from-yellow-700 dark:hover:to-amber-700 text-white font-semibold text-base rounded-xl shadow-lg shadow-yellow-500/30 dark:shadow-yellow-900/30 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-yellow-500/40 dark:hover:shadow-yellow-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="mr-2 h-5 w-5" />
            Start Scanner
          </Button>
        ) : (
          <Button
            onClick={stopScanning}
            disabled={isStopping}
            variant="outline"
            className="flex-1 h-14 border-2 border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500 font-semibold text-lg rounded-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStopping ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-red-300 border-t-transparent" />
                Stopping...
              </>
            ) : (
              <>
                <X className="mr-2 h-5 w-5" />
                Stop Scanner
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}