import type { LucideIcon } from "lucide-react"
import { Link } from "react-router"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * A single-number dashboard tile — label + value, per the stat-tile figure
 * contract. Links to `href` when given, using the same stretched-link
 * pattern as `NavCard` so the whole tile is the click target.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number
  icon: LucideIcon
  href?: string
}) {
  return (
    <Card
      className={cn(
        href &&
          "relative transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/40"
      )}
    >
      <CardContent className="flex items-center gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tracking-tight">
            {value.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">
            {href ? (
              <Link to={href} className="outline-none after:absolute after:inset-0">
                {label}
              </Link>
            ) : (
              label
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
