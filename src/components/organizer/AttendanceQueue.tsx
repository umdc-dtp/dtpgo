'use client';

import { Button } from '@/components/ui/button';
import type { AttendanceJob } from './useAttendanceQueue';

const labels = {
  queued: 'Queued', processing: 'Processing', recorded: 'Recorded',
  duplicate: 'Already recorded', failed: 'Failed',
};

const colors = {
  queued: 'text-blue-700 dark:text-blue-300',
  processing: 'text-blue-700 dark:text-blue-300',
  recorded: 'text-green-700 dark:text-green-300',
  duplicate: 'text-amber-700 dark:text-amber-300',
  failed: 'text-red-700 dark:text-red-300',
};

export function AttendanceQueue({ jobs, onRetry }: { jobs: AttendanceJob[]; onRetry: (id: string) => void }) {
  const pending = jobs.filter(job => job.status === 'queued' || job.status === 'processing').length;
  return (
    <section className="rounded-xl border bg-card p-4" aria-label="Attendance activity">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Attendance activity</h2>
        <span className="text-sm text-muted-foreground" aria-live="polite">{pending} pending</span>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Scans and manual entries will appear here.</p>
      ) : (
        <ol className="max-h-[29.5rem] space-y-2 overflow-y-auto" aria-live="polite">
          {jobs.map(job => (
            <li key={job.id} className="flex h-[5.5rem] items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{job.studentName || job.studentId}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {job.scanType === 'time_in' ? 'Time-in' : 'Time-out'} · {job.source === 'qr' ? 'QR' : 'Manual'} · {new Date(job.createdAt).toLocaleTimeString()}
                </p>
                {job.message && <p className="mt-1 truncate text-xs text-muted-foreground" title={job.message}>{job.message}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`font-medium ${colors[job.status]}`}>{labels[job.status]}</span>
                {job.status === 'failed' && <Button type="button" size="sm" variant="outline" onClick={() => onRetry(job.id)}>Retry</Button>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
