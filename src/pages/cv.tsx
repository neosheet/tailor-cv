import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { CvListPanel } from "@/components/cv/cv-list-panel"
import { TemplatesPanel } from "@/components/cv/templates-panel"
import { sections } from "@/lib/navigation"
import { useTabSearchParam } from "@/hooks/use-tab-search-param"

/**
 * CV List is first and the default — it's the thing you're most likely to
 * come back to; Templates is where you go to explore layouts.
 */
export function CvPage() {
  const page = sections.cvs
  const [tab, setTab] = useTabSearchParam("tab", "list")

  return (
    <>
      <PageHeader title={page.title} description={page.description} />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="list">CV List</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <CvListPanel />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesPanel />
        </TabsContent>
      </Tabs>
    </>
  )
}
