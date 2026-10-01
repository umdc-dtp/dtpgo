'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ManualInput({ onCapture }: { onCapture: (studentId: string) => boolean }) {
  const [studentId, setStudentId] = useState('');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = studentId.trim();
    if (!value) return;
    if (onCapture(value)) {
      setStudentId('');
      setMessage(`${value} added to attendance activity`);
    } else {
      setMessage(`${value} is already being processed`);
    }
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="manual-student-id" className="block text-sm font-medium">Student ID number</label>
      <div className="flex flex-wrap gap-2">
        <Input id="manual-student-id" ref={inputRef} value={studentId} onChange={event => setStudentId(event.target.value)}
          autoComplete="off" inputMode="numeric" className="min-w-48 flex-1" placeholder="Enter student ID" />
        <Button type="submit" disabled={!studentId.trim()}>Add to queue</Button>
      </div>
      <p className="text-sm text-muted-foreground" role="status">{message || 'You can enter the next ID while previous entries are processing.'}</p>
    </form>
  );
}
