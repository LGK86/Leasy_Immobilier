import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function PaymentsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-9 w-36 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <div className="flex items-center gap-4 py-3 border-b border-slate-100">
              {[40, 28, 20, 16, 12].map((w, i) => (
                <Skeleton key={i} className={`h-4 flex-${w === 40 ? '1' : 'none'} w-${w === 40 ? 'auto' : w}`} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-4 border-b border-slate-100 last:border-0">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
