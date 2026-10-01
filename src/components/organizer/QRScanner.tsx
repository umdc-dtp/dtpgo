'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CameraOption { id: string; label: string }
interface ExposureRange { min: number; max: number; step?: number }
interface CameraCapabilities extends MediaTrackCapabilities { exposureCompensation?: ExposureRange }

interface QRScannerProps {
  onCapture: (value: string) => boolean;
  onScanningStateChange?: (scanning: boolean) => void;
  onCleanup?: () => void;
}

export function QRScanner({ onCapture, onScanningStateChange, onCleanup }: QRScannerProps) {
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [cameraId, setCameraId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraInfo, setCameraInfo] = useState('');
  const [exposureInfo, setExposureInfo] = useState('');
  const [mirrorPreview, setMirrorPreview] = useState(false);
  const [detectedCount, setDetectedCount] = useState(0);
  const [decoderNotice, setDecoderNotice] = useState('');
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const lastReadRef = useRef(new Map<string, number>());
  const captureRef = useRef(onCapture);
  const stateChangeRef = useRef(onScanningStateChange);
  const cleanupRef = useRef(onCleanup);
  captureRef.current = onCapture;
  stateChangeRef.current = onScanningStateChange;
  cleanupRef.current = onCleanup;

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      if (!mounted) return;
      const found = devices.filter(device => device.kind === 'videoinput').map(device => ({ id: device.deviceId, label: device.label }));
      setCameras(found);
      const back = found.find(camera => /back|rear|environment/i.test(camera.label));
      setCameraId(back?.id || found[0]?.id || '');
    }).catch(() => { if (mounted) toast.error('Could not find cameras. Check browser permissions.'); });
    return () => { mounted = false; };
  }, []);

  const stop = useCallback(async () => {
    runIdRef.current += 1;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setStarting(false);
    setDetectedCount(0);
    setDecoderNotice('');
    stateChangeRef.current?.(false);
    cleanupRef.current?.();
  }, []);

  useEffect(() => {
    (window as Window & { __qrScannerCleanup?: () => Promise<void> }).__qrScannerCleanup = stop;
    return () => {
      void stop();
      delete (window as Window & { __qrScannerCleanup?: () => Promise<void> }).__qrScannerCleanup;
    };
  }, [stop]);

  const capture = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const now = Date.now();
    if (now - (lastReadRef.current.get(value) || 0) < 5000) return;
    lastReadRef.current.set(value, now);
    if (lastReadRef.current.size > 100) {
      for (const [key, time] of lastReadRef.current) {
        if (now - time > 5000) lastReadRef.current.delete(key);
      }
    }
    captureRef.current(value);
  };

  const start = async () => {
    if (starting || scanning) return;
    const runId = ++runIdRef.current;
    setStarting(true);
    setExposureInfo('');
    setDecoderNotice('');
    setCameraError('');
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(cameraId ? { deviceId: { ideal: cameraId } } : { facingMode: { ideal: 'environment' } }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });
      if (runIdRef.current !== runId) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      setCameraInfo(settings.width && settings.height ? `${settings.width} × ${settings.height}` : 'Camera ready');
      setMirrorPreview(settings.facingMode === 'user' ||
        (settings.facingMode !== 'environment' && !/back|rear|environment/i.test(track.label)));
      void navigator.mediaDevices.enumerateDevices().then(devices => {
        if (runIdRef.current !== runId) return;
        setCameras(devices.filter(device => device.kind === 'videoinput').map(device => ({ id: device.deviceId, label: device.label })));
        if (!cameraId) setCameraId(settings.deviceId || '');
      }).catch(() => {});

      // A negative EV helps with phone-screen glare only on cameras that expose this control.
      let exposure: ExposureRange | undefined;
      try { exposure = (track.getCapabilities?.() as CameraCapabilities | undefined)?.exposureCompensation; } catch { /* Optional browser control. */ }
      if (exposure && exposure.min < 0) {
        const target = Math.max(exposure.min, Math.min(exposure.max, -1));
        try {
          await track.applyConstraints({
            ...track.getConstraints(),
            advanced: [{ exposureCompensation: target } as MediaTrackConstraintSet],
          });
          setExposureInfo('Glare reduction on');
        } catch {
          setExposureInfo('Camera controls exposure automatically');
        }
      } else {
        setExposureInfo('Camera controls exposure automatically');
      }

      const video = videoRef.current;
      if (!video || runIdRef.current !== runId) { void stop(); return; }
      video.srcObject = stream;
      await video.play();
      if (runIdRef.current !== runId) return;

      let fallbackStarted = false;
      const useSingleCodeFallback = async () => {
        if (fallbackStarted || runIdRef.current !== runId) return;
        fallbackStarted = true;
        workerRef.current?.terminate();
        workerRef.current = null;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        setDecoderNotice('Multi-code detection unavailable. Scanning one QR code at a time.');
        try {
          const { default: QrScanner } = await import('qr-scanner');
          const scanSingle = async () => {
            if (runIdRef.current !== runId) return;
            try {
              const result = await QrScanner.scanImage(video, { returnDetailedScanResult: true });
              capture(result.data);
              setDetectedCount(1);
            } catch (error) {
              setDetectedCount(0);
              const message = error instanceof Error ? error.message : String(error);
              if (!/no qr|no barcode|not found/i.test(message)) {
                setDecoderNotice(`QR detection error: ${message}`);
              }
            }
            if (runIdRef.current === runId) timerRef.current = window.setTimeout(scanSingle, 250);
          };
          void scanSingle();
        } catch (error) {
          setDecoderNotice(error instanceof Error ? `QR detection unavailable: ${error.message}` : 'QR detection unavailable');
        }
      };

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) { void useSingleCodeFallback(); }

      const scanFrame = () => {
        if (runIdRef.current !== runId || fallbackStarted || !context) return;
        if (!video.videoWidth || !video.videoHeight) {
          timerRef.current = window.setTimeout(scanFrame, 120);
          return;
        }
        const scale = Math.min(1, 1920 / video.videoWidth);
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        try {
          workerRef.current?.postMessage({ frame }, [frame.data.buffer]);
        } catch {
          void useSingleCodeFallback();
        }
      };
      if (context) {
        try {
          const worker = new Worker('/vendor/qr-decode-worker.js');
          workerRef.current = worker;
          worker.onmessage = (event: MessageEvent<{ values?: string[]; error?: string }>) => {
            if (runIdRef.current !== runId || fallbackStarted) return;
            if (event.data.error) { void useSingleCodeFallback(); return; }
            setDetectedCount(event.data.values?.length || 0);
            for (const value of event.data.values || []) capture(value);
            timerRef.current = window.setTimeout(scanFrame, 120);
          };
          worker.onerror = () => { void useSingleCodeFallback(); };
        } catch {
          void useSingleCodeFallback();
        }
      }
      setScanning(true);
      stateChangeRef.current?.(true);
      if (!fallbackStarted) scanFrame();
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      if (runIdRef.current === runId) {
        const message = error instanceof Error ? error.message : 'Could not start camera';
        setCameraError(message);
        toast.error(message);
        void stop();
      }
    } finally {
      if (runIdRef.current === runId) setStarting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="attendance-camera" className="text-sm font-medium">Camera</label>
        <select id="attendance-camera" className="max-w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={cameraId} disabled={scanning || starting}
          onChange={event => setCameraId(event.target.value)}>
          {cameras.length === 0 && <option value="">Default camera</option>}
          {cameras.map((camera, index) => <option key={camera.id || index} value={camera.id}>{camera.label || `Camera ${index + 1}`}</option>)}
        </select>
        <Button type="button" onClick={() => { if (scanning) void stop(); else void start(); }} disabled={starting}>
          {starting ? 'Starting…' : scanning ? 'Stop camera' : 'Start camera'}
        </Button>
        {scanning && <span className="text-xs text-muted-foreground">{cameraInfo} · {exposureInfo}</span>}
      </div>
      {cameraError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">Camera could not start: {cameraError}</p>}
      {decoderNotice && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{decoderNotice}</p>}
      <div className="relative mx-auto aspect-video w-full max-w-2xl overflow-hidden rounded-xl border bg-slate-950">
        {!scanning && !starting && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
            <span className="rounded-full bg-white/10 p-4"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8"><path d="M14 4h-4L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-2-2Z"/><circle cx="12" cy="13" r="3"/></svg></span>
            <span className="text-sm font-medium">Camera preview</span>
            <span className="text-xs text-slate-400">Start the camera to scan student QR codes</span>
          </div>
        )}
        <video ref={videoRef} muted playsInline className={`h-full w-full object-contain ${mirrorPreview ? '-scale-x-100' : ''}`} />
        {scanning && detectedCount > 0 && <div className="absolute bottom-3 left-3 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white">{detectedCount} QR {detectedCount === 1 ? 'code' : 'codes'} in view</div>}
      </div>
      <p className="text-sm text-muted-foreground">Multiple QR codes can be captured in one view. For 1–2 meters, enlarge each code on the phone and keep it sharp, steady, and free of glare.</p>
    </div>
  );
}
