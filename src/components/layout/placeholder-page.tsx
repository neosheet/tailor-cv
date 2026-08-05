import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PageHeader } from "@/components/layout/page-header"
import type { NavPage } from "@/lib/navigation"

/**
 * Every section renders the same shape until it has a real implementation:
 * a header from the nav manifest plus an empty state with an inert action.
 */
export function PlaceholderPage({ page }: { page: NavPage }) {
  const Icon = page.icon

  return (
    <>
      <PageHeader title={page.title} description={page.description} />
      {/* flex-none: Empty grows by default, which stretches to the viewport here. */}
      <Empty className="min-h-72 flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{page.empty.title}</EmptyTitle>
          <EmptyDescription>{page.empty.body}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button disabled>{page.empty.action}</Button>
          <p className="text-xs text-muted-foreground">Not built yet.</p>
        </EmptyContent>
      </Empty>
    </>
  )
}
