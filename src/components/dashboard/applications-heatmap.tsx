import { format, isSameMonth, parseISO } from "date-fns"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { buildApplicationHeatmap, type HeatmapDay } from "@/lib/application-heatmap"

const LEVEL_CLASS: Record<HeatmapDay["level"], string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
}

function DayCell({ day }: { day: HeatmapDay }) {
  const date = parseISO(day.date)
  const count = day.count === 1 ? "1 application" : `${day.count} applications`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "h-5 w-full rounded-xs hover:outline-2 hover:outline-offset-1 hover:outline-ring",
              LEVEL_CLASS[day.level]
            )}
          />
        }
      />
      <TooltipContent sideOffset={8} className="pointer-events-none">
        <div className="flex flex-col gap-0.5 py-0.5 text-center">
          <span className="font-medium">{format(date, "EEEE")}</span>
          <span>{format(date, "MMM d, yyyy")}</span>
          <span>{count} applied</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
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
        <div className="overflow-x-auto pb-2 pr-2">
          <div className="flex min-w-[872px] flex-col gap-1">
            <div className="flex gap-1 pl-7">
              {weeks.map((week, i) => (
                <div
                  key={week[0].date}
                  className="min-w-0 flex-1 text-xs whitespace-nowrap text-muted-foreground"
                >
                  {monthLabel(week, weeks[i - 1])}
                </div>
              ))}
            </div>
            <div className="flex gap-1">
              <div className="flex w-6 shrink-0 flex-col gap-1">
                {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
                  <div key={i} className="h-5 text-[10px] leading-5 text-muted-foreground">
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex flex-1 gap-1">
                {weeks.map((week) => (
                  <div key={week[0].date} className="flex min-w-0 flex-1 flex-col gap-1">
                    {week.map((day) => (
                      <DayCell key={day.date} day={day} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
