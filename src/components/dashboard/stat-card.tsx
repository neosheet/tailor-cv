import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

/** A single-number dashboard tile — label + value, per the stat-tile figure contract. */
export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tracking-tight">
            {value.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  )
}
