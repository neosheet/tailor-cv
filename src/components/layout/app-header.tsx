import * as React from "react"
import { Link, useLocation } from "react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getBreadcrumbTrail } from "@/lib/navigation"

export function AppHeader() {
  const { pathname } = useLocation()
  const trail = getBreadcrumbTrail(pathname)

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      {trail.length === 0 ? null : (
        <>
          {/* Override the component's data-vertical:self-stretch, which would
              otherwise pin a fixed-height separator to the top of the header. */}
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-center"
          />
          <Breadcrumb>
            <BreadcrumbList>
              {trail.map((page, index) => {
                const isLast = index === trail.length - 1

                // BreadcrumbSeparator renders an <li>, so it sits beside the item.
                return (
                  <React.Fragment key={page.path}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{page.title}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink render={<Link to={page.path} />}>
                          {page.title}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {isLast ? null : <BreadcrumbSeparator />}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      )}
    </header>
  )
}
