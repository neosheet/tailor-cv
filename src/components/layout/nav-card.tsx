import { Link } from "react-router"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { NavPage } from "@/lib/navigation"

/**
 * A card that links to a section. The title carries a stretched link, so the
 * whole card is the click target while the accessible name stays the title.
 */
export function NavCard({
  page,
  action,
}: {
  page: NavPage
  action?: React.ReactNode
}) {
  const Icon = page.icon

  return (
    <Card className="relative transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/40">
      <CardHeader>
        <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
          <Icon className="size-4" />
        </div>
        <CardTitle>
          <Link
            to={page.path}
            className="outline-none after:absolute after:inset-0"
          >
            {page.title}
          </Link>
        </CardTitle>
        <CardDescription>{page.description}</CardDescription>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
    </Card>
  )
}
