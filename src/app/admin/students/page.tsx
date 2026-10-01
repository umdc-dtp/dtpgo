'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import StudentsTable from '@/components/admin/StudentsTable';
import StudentsFilter, { FilterParams } from '@/components/admin/StudentsFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  UserPlus, 
  MoreHorizontal,
  Grid3X3
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Toaster } from '@/components/ui/sonner';

interface StudentStats {
  totalStudents: number;
  thisMonth: number;
  programs: number;
  qrGenerated: number;
}

export default function StudentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({});
  const { data: stats = { totalStudents: 0, thisMonth: 0, programs: 0, qrGenerated: 0 } } = useSWR<StudentStats>(
    '/api/admin/students/stats',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch student stats');
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  return (
    <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-black">
              <Users className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Students
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage student records, view details, and generate QR codes
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Add Student Button */}
          <Button className="hidden sm:flex items-center gap-2 bg-yellow-500 text-black hover:bg-yellow-600">
            <UserPlus className="h-4 w-4" />
            Add Student
          </Button>

          {/* Mobile Add Button */}
          <Button size="icon" className="sm:hidden bg-yellow-500 text-black hover:bg-yellow-600">
            <UserPlus className="h-4 w-4" />
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Students
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2 sm:hidden">
                <UserPlus className="h-4 w-4" />
                Add Student
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Advanced Filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Button */}
            <Button 
              variant={showFilters ? "default" : "outline"} 
              size="sm" 
              className={`flex items-center gap-2 ${showFilters ? 'ring-1 ring-yellow-500' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {Object.keys(filters).length > 0 && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-xs text-black">
                  {Object.keys(filters).length}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Filter Component */}
        <StudentsFilter 
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          onFilterChange={setFilters}
          initialFilters={filters}
        />
      </div>

      {/* Content Area */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 overflow-hidden">
        <div className="p-3 sm:p-6">
          <StudentsTable searchQuery={searchQuery} filters={filters} />
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Students
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalStudents}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              This Month
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.thisMonth}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Programs
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.programs}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Scanned
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.qrGenerated}
          </p>
        </div>
      </div>

      <Toaster richColors />
    </div>
  );
}
