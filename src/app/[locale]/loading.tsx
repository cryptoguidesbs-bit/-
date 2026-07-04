import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container flex flex-col items-center gap-6 py-16 md:py-24">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-14 w-3/4 max-w-xl" />
      <Skeleton className="h-6 w-1/2 max-w-md" />
      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  )
}
