import { PageHeader } from "@/components/layout/page-header"
import { ApplicationListPanel } from "@/components/applications/application-list-panel"
import { sections } from "@/lib/navigation"

export function ApplicationsPage() {
  const page = sections.applications

  return (
    <>
      <PageHeader title={page.title} description={page.description} />
      <ApplicationListPanel />
    </>
  )
}
