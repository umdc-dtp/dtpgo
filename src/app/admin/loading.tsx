export default function AdminLoading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading page">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border bg-gray-100 dark:bg-gray-800" />
    </div>
  )
}
