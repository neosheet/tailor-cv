import { addDays, format, startOfDay, startOfWeek } from "date-fns"

/**
 * Dashboard's "applications applied each day" heatmap. Buckets `appliedAt`
 * timestamps into local calendar days, then lays out a GitHub-style grid:
 * one column per week, one row per weekday, trailing back from today.
 */

export type HeatmapDay = {
  date: string
  count: number
  /** 0 = no activity, 4 = busiest bucket. Relative to the max day in range. */
  level: 0 | 1 | 2 | 3 | 4
}

export type HeatmapWeek = HeatmapDay[]

function levelFor(count: number, max: number): HeatmapDay["level"] {
  if (count === 0) return 0
  if (max <= 1) return 4

  const ratio = count / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

/**
 * Builds `weeks` full Sun–Sat weeks ending on the week containing `today`.
 * `appliedDates` are `applications.applied_at` timestamps (one per
 * application, duplicates expected on days with more than one).
 */
export function buildApplicationHeatmap(
  appliedDates: (string | null)[],
  weeks = 53,
  today: Date = new Date()
): HeatmapWeek[] {
  const countsByDay = new Map<string, number>()

  for (const raw of appliedDates) {
    if (!raw) continue
    const key = format(startOfDay(new Date(raw)), "yyyy-MM-dd")
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
  }

  const max = Math.max(0, ...countsByDay.values())

  const gridStart = startOfWeek(addDays(startOfDay(today), -(weeks - 1) * 7))
  const totalDays = weeks * 7

  const days: HeatmapDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(gridStart, i)
    const key = format(date, "yyyy-MM-dd")
    const count = countsByDay.get(key) ?? 0
    return { date: key, count, level: levelFor(count, max) }
  })

  const result: HeatmapWeek[] = []
  for (let i = 0; i < days.length; i += 7) {
    result.push(days.slice(i, i + 7))
  }
  return result
}
