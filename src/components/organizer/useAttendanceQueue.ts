'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AttendanceStatus = 'queued' | 'processing' | 'recorded' | 'duplicate' | 'failed';
export type ScanType = 'time_in' | 'time_out';

export interface AttendanceStudentPreview {
  studentIdNumber: string;
  firstName: string;
  lastName: string;
}

export interface AttendanceJob {
  id: string;
  key: string;
  studentId: string;
  sessionId: string;
  eventId: string;
  scanType: ScanType;
  source: 'qr' | 'manual';
  status: AttendanceStatus;
  createdAt: number;
  studentName?: string;
  message?: string;
}

interface SessionForQueue {
  id: string;
  eventId: string;
  timeInStart: string;
  timeInEnd: string;
  timeOutStart?: string;
  timeOutEnd?: string;
}

const MAX_IN_FLIGHT = 2;
const MAX_HISTORY = 50;

function studentIdFromQr(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      const data = parsed as Record<string, unknown>;
      // The attendance API looks up the public student ID number, not the database ID.
      if (typeof data.studentIdNumber === 'string') return data.studentIdNumber.trim();
      if (typeof data.studentId === 'string') return data.studentId.trim();
    }
  } catch {
    // Standard student QR codes contain only the ID number.
  }
  return trimmed;
}

function scanTypeForSession(session: SessionForQueue): ScanType {
  const now = Date.now();
  if (session.timeOutStart && session.timeOutEnd &&
      now >= new Date(session.timeOutStart).getTime() &&
      now <= new Date(session.timeOutEnd).getTime()) return 'time_out';
  return 'time_in';
}

export function useAttendanceQueue(onRecorded: () => void) {
  const [jobs, setJobs] = useState<AttendanceJob[]>([]);
  const jobsRef = useRef<AttendanceJob[]>([]);
  const inFlightRef = useRef(0);
  const mountedRef = useRef(true);
  const onRecordedRef = useRef(onRecorded);
  const directoryRef = useRef(new Map<string, string>());
  onRecordedRef.current = onRecorded;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const publish = useCallback((next: AttendanceJob[]) => {
    jobsRef.current = next;
    if (mountedRef.current) setJobs(next);
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<AttendanceJob>) => {
    publish(jobsRef.current.map(job => job.id === id ? { ...job, ...patch } : job));
  }, [publish]);

  const setStudentDirectory = useCallback((students: AttendanceStudentPreview[]) => {
    directoryRef.current = new Map(students.map(student => [
      student.studentIdNumber,
      `${student.firstName} ${student.lastName}`.trim(),
    ]));
    publish(jobsRef.current.map(job => {
      const studentName = directoryRef.current.get(job.studentId);
      return studentName && (job.status === 'queued' || job.status === 'processing')
        ? { ...job, studentName, message: 'Student found · saving attendance…' }
        : job;
    }));
  }, [publish]);

  const processJob = useCallback(async (job: AttendanceJob) => {
    updateJob(job.id, { status: 'processing', message: job.studentName ? 'Student found · saving attendance…' : 'Checking student · saving attendance…' });
    try {
      const response = await fetch('/api/organizer/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: job.studentId,
          sessionId: job.sessionId,
          eventId: job.eventId,
          scanType: job.scanType,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const studentName = data.student?.firstName && data.student?.lastName
        ? `${data.student.firstName} ${data.student.lastName}` : undefined;
      if (studentName) directoryRef.current.set(job.studentId, studentName);
      const resolvedName = studentName || jobsRef.current.find(item => item.id === job.id)?.studentName;

      if (response.ok && data.success) {
        updateJob(job.id, { status: 'recorded', studentName: resolvedName, message: 'Attendance recorded' });
        if (mountedRef.current) onRecordedRef.current();
      } else if (response.status === 409) {
        updateJob(job.id, { status: 'duplicate', studentName: resolvedName, message: data.message || 'Already recorded' });
      } else {
        updateJob(job.id, { status: 'failed', studentName: resolvedName, message: data.message || data.error || `Request failed (${response.status})` });
      }
    } catch (error) {
      updateJob(job.id, { status: 'failed', message: error instanceof Error ? error.message : 'Network error' });
    } finally {
      inFlightRef.current -= 1;
      pumpRef.current();
    }
  }, [updateJob]);

  const pumpRef = useRef<() => void>(() => {});
  pumpRef.current = () => {
    while (inFlightRef.current < MAX_IN_FLIGHT) {
      const next = jobsRef.current.find(job => job.status === 'queued');
      if (!next) break;
      inFlightRef.current += 1;
      // Mark synchronously before starting another worker.
      updateJob(next.id, { status: 'processing' });
      void processJob(next);
    }
  };

  const enqueue = useCallback((raw: string, source: 'qr' | 'manual', session: SessionForQueue) => {
    const studentId = source === 'qr' ? studentIdFromQr(raw) : raw.trim();
    if (!studentId) return false;
    const scanType = scanTypeForSession(session);
    const key = `${session.id}:${studentId}:${scanType}`;
    if (jobsRef.current.some(job => job.key === key && (job.status === 'queued' || job.status === 'processing'))) {
      return false;
    }
    const job: AttendanceJob = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, key, studentId, sessionId: session.id, eventId: session.eventId,
      scanType, source, status: 'queued', createdAt: Date.now(),
      studentName: directoryRef.current.get(studentId),
      message: directoryRef.current.has(studentId) ? 'Student found · saving attendance…' : 'Checking student · saving attendance…',
    };
    const next = [job, ...jobsRef.current];
    publish(next.filter(item => item.status === 'queued' || item.status === 'processing')
      .concat(next.filter(item => item.status !== 'queued' && item.status !== 'processing').slice(0, MAX_HISTORY))
      .sort((a, b) => b.createdAt - a.createdAt));
    pumpRef.current();
    return true;
  }, [publish]);

  const retry = useCallback((id: string) => {
    const job = jobsRef.current.find(item => item.id === id);
    if (!job || job.status !== 'failed') return;
    if (jobsRef.current.some(item => item.id !== id && item.key === job.key &&
      (item.status === 'queued' || item.status === 'processing'))) return;
    updateJob(id, { status: 'queued', message: undefined });
    pumpRef.current();
  }, [updateJob]);

  return { jobs, enqueue, retry, setStudentDirectory };
}
