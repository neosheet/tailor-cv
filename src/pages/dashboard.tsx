import { ArrowRightIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { NavCard } from "@/components/layout/nav-card"
import { PageHeader } from "@/components/layout/page-header"
import { sections } from "@/lib/navigation"

/** The three places you'd go next from an empty pipeline. */
const nextSteps = [sections.inventory, sections.cvs, sections.applications]

export function DashboardPage() {
  const { icon: PipelineIcon, empty } = sections.applications

  return (
    <>
      <PageHeader
        title={sections.dashboard.title}
        description={sections.dashboard.description}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nextSteps.map((page) => (
          <NavCard key={page.path} page={page} />
        ))}
      </div>

      <Empty className="min-h-72 flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PipelineIcon />
          </EmptyMedia>
          <EmptyTitle>{empty.title}</EmptyTitle>
          <EmptyDescription>{empty.body}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            render={<Link to={sections.inventory.path} />}
            nativeButton={false}
          >
            Build your Profile
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </EmptyContent>
      </Empty>
    </>
  )
}
