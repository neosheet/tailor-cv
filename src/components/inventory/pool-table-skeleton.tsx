import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Table-shaped placeholder for a pool whose rows haven't loaded yet —
 * mirrors PoolTable's checkbox + column layout so the swap-in doesn't jump.
 */
export function PoolTableSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Skeleton className="h-4 w-4" />
          </TableHead>
          {Array.from({ length: columns }).map((_, index) => (
            <TableHead key={index}>
              <Skeleton className="h-4 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 6 }).map((_, row) => (
          <TableRow key={row}>
            <TableCell>
              <Skeleton className="h-4 w-4" />
            </TableCell>
            {Array.from({ length: columns }).map((_, col) => (
              <TableCell key={col}>
                <Skeleton className="h-4 w-full max-w-40" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
