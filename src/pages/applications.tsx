import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { ApplicationListPanel } from "@/components/applications/application-list-panel"
import { ApplicationKanbanPanel } from "@/components/applications/application-kanban-panel"
import { sections } from "@/lib/navigation"
import { useTabSearchParam } from "@/hooks/use-tab-search-param"

export function ApplicationsPage() {
  const page = sections.applications
  const [tab, setTab] = useTabSearchParam("tab", "list")

  return (
    <>
      <PageHeader title={page.title} description={page.description} />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="list">Applications List</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="archive">Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ApplicationListPanel />
        </TabsContent>
        <TabsContent value="kanban">
          <ApplicationKanbanPanel />
        </TabsContent>
        <TabsContent value="archive">
          <ApplicationListPanel archived />
        </TabsContent>
      </Tabs>
    </>
  )
}
