import { ChevronRightIcon, FileTextIcon } from "lucide-react"
import { useState } from "react"
import { Link, useLocation } from "react-router"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { inventoryGroups, sections, type NavPage } from "@/lib/navigation"
import { UserMenu } from "@/components/layout/user-menu"
import { cn } from "@/lib/utils"

function SectionMenuItem({ page }: { page: NavPage }) {
  const { pathname } = useLocation()
  const Icon = page.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link to={page.path} />}
        isActive={pathname === page.path}
        tooltip={page.title}
      >
        <Icon />
        <span>{page.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function InventoryMenu() {
  const { pathname } = useLocation()
  const InventoryIcon = sections.inventory.icon
  const isInventorySection = pathname.startsWith("/inventory")
  const [open, setOpen] = useState(isInventorySection)
  const [wasInventorySection, setWasInventorySection] =
    useState(isInventorySection)

  // Entering /inventory reveals the pools; collapsing again is still the
  // user's call, so this only fires on the transition into the section.
  if (isInventorySection !== wasInventorySection) {
    setWasInventorySection(isInventorySection)

    if (isInventorySection) {
      setOpen(true)
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        {/* The button navigates to Overview — the only thing reachable when the
            sidebar is icon-only. Toggling lives on the chevron beside it. */}
        <SidebarMenuButton
          render={<Link to={sections.inventory.path} />}
          isActive={pathname === sections.inventory.path}
          tooltip={sections.inventory.title}
          onClick={() => setOpen(true)}
        >
          <InventoryIcon />
          <span>{sections.inventory.title}</span>
        </SidebarMenuButton>
        <SidebarMenuAction render={<CollapsibleTrigger />}>
          <ChevronRightIcon
            className={cn("transition-transform", open && "rotate-90")}
          />
          <span className="sr-only">Toggle Profile sections</span>
        </SidebarMenuAction>
        <CollapsibleContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton
                render={<Link to={sections.inventory.path} />}
                isActive={pathname === sections.inventory.path}
              >
                <span>Overview</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>

          {inventoryGroups.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="h-6 pl-5">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenuSub>
                  {group.pages.map((page) => (
                    <SidebarMenuSubItem key={page.path}>
                      <SidebarMenuSubButton
                        render={<Link to={page.path} />}
                        isActive={pathname === page.path}
                      >
                        <span>{page.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

export function AppSidebar() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to={sections.dashboard.path} />}
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileTextIcon />
              </div>
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">Tailor CV</span>
                <span className="truncate text-xs text-muted-foreground">
                  One profile, many CVs
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SectionMenuItem page={sections.dashboard} />
              <InventoryMenu />
              <SectionMenuItem page={sections.cvs} />
              <SectionMenuItem page={sections.templates} />
              <SectionMenuItem page={sections.applications} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SectionMenuItem page={sections.settings} />
        </SidebarMenu>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}
