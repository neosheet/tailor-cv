import { ArrowRightIcon, FileTextIcon, SendIcon, UsersIcon } from "lucide-react"
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
import { ApplicationsHeatmap } from "@/components/dashboard/applications-heatmap"
import { StatCard } from "@/components/dashboard/stat-card"
import { useApplicationStore } from "@/lib/application-store"
import { sections } from "@/lib/navigation"
import { usePersonaStore } from "@/lib/persona-store"

/** The places you'd go next from an empty pipeline. */
const nextSteps = [sections.cvs, sections.applications]

export function DashboardPage() {
  const { icon: PipelineIcon, empty } = sections.applications
  const { personas, cvs } = usePersonaStore()
  const { applications } = useApplicationStore()

  return (
    <>
      <PageHeader
        title={sections.dashboard.title}
        description={sections.dashboard.description}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total CVs" value={cvs.length} icon={FileTextIcon} />
        <StatCard label="Total personas" value={personas.length} icon={UsersIcon} />
        <StatCard
          label="Total applications"
          value={applications.length}
          icon={SendIcon}
        />
      </div>

      <ApplicationsHeatmap
        appliedDates={applications.map((application) => application.appliedAt)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
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
