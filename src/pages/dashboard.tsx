import { FileTextIcon, SendIcon, UsersIcon } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { ApplicationsHeatmap } from "@/components/dashboard/applications-heatmap"
import { StatCard } from "@/components/dashboard/stat-card"
import { useApplicationStore } from "@/lib/application-store"
import { sections } from "@/lib/navigation"
import { usePersonaStore } from "@/lib/persona-store"

export function DashboardPage() {
  const { personas, cvs } = usePersonaStore()
  const { applications } = useApplicationStore()

  return (
    <>
      <PageHeader
        title={sections.dashboard.title}
        description={sections.dashboard.description}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total CVs"
          value={cvs.length}
          icon={FileTextIcon}
          href={sections.cvs.path}
        />
        <StatCard
          label="Total personas"
          value={personas.length}
          icon={UsersIcon}
          href={sections.personas.path}
        />
        <StatCard
          label="Total applications"
          value={applications.length}
          icon={SendIcon}
          href={sections.applications.path}
        />
      </div>

      <ApplicationsHeatmap
        appliedDates={applications.map((application) => application.appliedAt)}
      />
    </>
  )
}
