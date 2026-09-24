'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, QrCode, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QRLookupResult {
  studentName: string;
  studentIdNumber: string;
  qrCode: string;
}

export default function StudentQRCodePage() {
  const [name, setName] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [result, setResult] = useState<QRLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim().replace(/\s+/g, ' ');
    const trimmedStudentId = studentIdNumber.trim();

    setResult(null);
    setError(null);

    if (!trimmedName || !trimmedStudentId) {
      setError('Please enter both your student name and student ID number.');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/public/student-qr-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, studentIdNumber: trimmedStudentId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Student record not found. Please check your name and student ID number.');
        return;
      }

      setResult(data as QRLookupResult);
    } catch {
      setError('Unable to search right now. Please try again later.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchAgain = () => {
    setResult(null);
    setError(null);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-yellow-50 via-white to-amber-50 px-4 py-8 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 sm:py-12">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-yellow-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-2xl">
        <Link href="/join" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200">
          <ArrowLeft className="size-4" />
          Back to registration
        </Link>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
            <QrCode className="size-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Get My QR Code
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-gray-600 dark:text-gray-300">
            Verify your registered student details to retrieve your existing event check-in QR code.
          </p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:p-8">
          {result ? (
            <div className="text-center">
              <div className="mb-6 flex items-center justify-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="size-5" />
                <span className="font-semibold">Student record verified</span>
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Student QR Code</h2>
              <div className="mt-3 space-y-1 text-gray-600 dark:text-gray-300">
                <p className="font-semibold text-gray-900 dark:text-white">{result.studentName}</p>
                <p>{result.studentIdNumber}</p>
              </div>

              <div className="mx-auto mt-6 w-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-600">
                <Image
                  src={result.qrCode}
                  alt={`QR code for ${result.studentName}`}
                  width={320}
                  height={320}
                  unoptimized
                  className="h-auto w-full max-w-[min(80vw,320px)]"
                />
              </div>

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button type="button" variant="outline" onClick={handleSearchAgain}>
                  <Search className="mr-2 size-4" />
                  Search Again
                </Button>
                <Link href="/join">
                  <Button type="button" className="w-full sm:w-auto">
                    <ArrowLeft className="mr-2 size-4" />
                    Return to Registration
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-2">
                <Label htmlFor="student-name" className="flex items-center gap-2 font-semibold">
                  <UserRound className="size-4 text-yellow-600" />
                  Student Name
                </Label>
                <Input
                  id="student-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  disabled={isSearching}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="student-id" className="font-semibold">Student ID Number</Label>
                <Input
                  id="student-id"
                  value={studentIdNumber}
                  onChange={(event) => setStudentIdNumber(event.target.value)}
                  placeholder="Enter your student ID"
                  autoComplete="off"
                  disabled={isSearching}
                  className="h-12"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={isSearching} className="h-12 w-full bg-yellow-400 text-black hover:bg-yellow-500">
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Find My QR Code
                  </>
                )}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
