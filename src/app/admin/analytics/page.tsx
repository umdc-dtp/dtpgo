import React from 'react';
import { BarChart3 } from 'lucide-react';
import { countStudents } from '@/lib/db/queries/students';
import { getPrograms } from '@/lib/db/queries/programs';
import { countStudentsByProgram, countStudentsByRegistrationSource } from '@/lib/db/queries/analytics';
import AnalyticsCards from '@/components/admin/AnalyticsCards';
import AnalyticsCharts from '@/components/admin/AnalyticsCharts';

export default async function AnalyticsPage() {
  const [totalStudents, programs, studentsByProgram, studentsBySource] = await Promise.all([
    countStudents({}),
    getPrograms(),
    countStudentsByProgram(),
    countStudentsByRegistrationSource(),
  ]);

  const chartDataByProgram = studentsByProgram.map(p => ({ name: p.program, count: p.count }));
  const chartDataBySource = studentsBySource.map(s => ({ name: s.source, count: s.count }));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 text-black shadow-inner">
          <BarChart3 className="h-4 w-4" />
        </div>
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>
      <AnalyticsCards totalStudents={totalStudents} totalPrograms={programs.length} />
      <AnalyticsCharts studentsByProgram={chartDataByProgram} studentsBySource={chartDataBySource} />
    </div>
  );
} 
