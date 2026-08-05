import { SettingsIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { TagsPanel } from "@/components/settings/tags-panel"
import { sections } from "@/lib/navigation"

/**
 * Settings, one tab per thing there is to configure.
 *
 * Tags is first and the default: it is the tab that does something, and landing
 * on an empty General placeholder would make the page look unbuilt.
 */
export function SettingsPage() {
  const page = sections.settings

  return (
    <>
      <PageHeader title={page.title} description={page.description} />

      <Tabs defaultValue="tags" className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        <TabsContent value="tags">
          <TagsPanel />
        </TabsContent>

        <TabsContent value="general">
          <Empty className="min-h-72 flex-none border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SettingsIcon />
              </EmptyMedia>
              <EmptyTitle>{page.empty.title}</EmptyTitle>
              <EmptyDescription>{page.empty.body}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsContent>
      </Tabs>
    </>
  )
}
