import { format, isSameMonth, parseISO } from "date-fns"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { buildApplicationHeatmap, type HeatmapDay } from "@/lib/application-heatmap"

const LEVEL_CLASS: Record<HeatmapDay["level"], string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
}

function dayLabel(day: HeatmapDay): string {
  const count = day.count === 1 ? "1 application" : `${day.count} applications`
  return `${count} applied on ${format(parseISO(day.date), "MMM d, yyyy")}`
}

/** Month label for a week column: only shown where a new month starts within it. */
function monthLabel(week: HeatmapDay[], previousWeek: HeatmapDay[] | undefined): string | null {
  const firstOfMonth = week.find((day) => day.date.endsWith("-01"))
  if (!firstOfMonth) return null
  if (previousWeek && isSameMonth(parseISO(previousWeek[0].date), parseISO(firstOfMonth.date))) {
    return null
  }
  return format(parseISO(firstOfMonth.date), "MMM")
}

export function ApplicationsHeatmap({
  appliedDates,
}: {
  appliedDates: (string | null)[]
}) {
  const weeks = buildApplicationHeatmap(appliedDates)
  const countInRange = weeks
    .flat()
    .reduce((total, day) => total + day.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applications applied</CardTitle>
        <CardDescription>
          {countInRange === 0
            ? "No applications tracked as applied yet."
            : `${countInRange.toLocaleString()} application${countInRange === 1 ? "" : "s"} applied over the last year.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex min-w-max flex-col gap-1">
            <div className="flex gap-1 pl-7">
              {weeks.map((week, i) => (
                <div key={week[0].date} className="w-3 shrink-0 text-xs text-muted-foreground">
                  {monthLabel(week, weeks[i - 1])}
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <div className="flex w-6 shrink-0 flex-col gap-1">
                {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                  <div key={i} className="h-3 text-[10px] leading-3 text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex gap-1">
                {weeks.map((week) => (
                  <div key={week[0].date} className="flex flex-col gap-1">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        title={dayLabel(day)}
                        aria-label={dayLabel(day)}
                        className={cn("size-3 rounded-sm", LEVEL_CLASS[day.level])}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1.5 pt-1 text-xs text-muted-foreground">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as const).map((level) => (
                <div key={level} className={cn("size-3 rounded-sm", LEVEL_CLASS[level])} />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
