import {
  AwardIcon,
  BriefcaseIcon,
  FileTextIcon,
  FolderKanbanIcon,
  GraduationCapIcon,
  HandHeartIcon,
  HeartIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  LayersIcon,
  LanguagesIcon,
  type LucideIcon,
  NewspaperIcon,
  QuoteIcon,
  ScrollTextIcon,
  SendIcon,
  SettingsIcon,
  SparklesIcon,
  UserIcon,
} from "lucide-react"

/**
 * The app's information architecture, straight from `docs/specs/01-app-taxonomy.md`.
 * Sidebar, breadcrumbs, page headers, and the Inventory index all read from here —
 * add a page once and it shows up everywhere.
 */
export type NavPage = {
  /** Route path. */
  path: string
  /** Title used in the sidebar, breadcrumb, and page header. */
  title: string
  /** One-line description shown under the page title. */
  description: string
  icon: LucideIcon
  /** Copy for the placeholder empty state. */
  empty: {
    title: string
    body: string
    /** Label of the (currently inert) primary action. */
    action: string
  }
}

/** Inventory pools, keyed by `resume.json` top-level key. */
export const inventoryPages = {
  basics: {
    path: "/inventory/basics",
    title: "Basics",
    description:
      "Six small pools — name, headline, summary, contact, location, and social. A CV takes one of each, except social where it can show several.",
    icon: UserIcon,
    empty: {
      title: "No basics yet",
      body: "This is the one section that appears on every CV unconditionally.",
      action: "Add your details",
    },
  },
  work: {
    path: "/inventory/work",
    title: "Work",
    description:
      "Every job you've held. Each CV picks which roles appear, then which responsibilities and highlights show within them.",
    icon: BriefcaseIcon,
    empty: {
      title: "No work entries yet",
      body: "Add every role you've held. Each CV selects from them — nothing here is sent to anyone.",
      action: "Add a role",
    },
  },
  education: {
    path: "/inventory/education",
    title: "Education",
    description:
      "Institutions, degrees, and the courses under each. CVs pick which entries and which courses to show.",
    icon: GraduationCapIcon,
    empty: {
      title: "No education entries yet",
      body: "Add schools and degrees here, along with any coursework worth surfacing.",
      action: "Add an entry",
    },
  },
  skills: {
    path: "/inventory/skills",
    title: "Skills",
    description:
      "Skill groups and their keywords. A CV picks which groups appear and which keywords within each.",
    icon: SparklesIcon,
    empty: {
      title: "No skills yet",
      body: "Group related keywords together — a Backend group might hold Node.js, Postgres, and Redis.",
      action: "Add a skill group",
    },
  },
  languages: {
    path: "/inventory/languages",
    title: "Languages",
    description:
      "Languages you speak and your fluency in each. CVs include or omit whole entries.",
    icon: LanguagesIcon,
    empty: {
      title: "No languages yet",
      body: "Add each language with its fluency level.",
      action: "Add a language",
    },
  },
  projects: {
    path: "/inventory/projects",
    title: "Projects",
    description:
      "Things you've built, with their highlights, keywords, and roles. The most deeply nested pool.",
    icon: FolderKanbanIcon,
    empty: {
      title: "No projects yet",
      body: "Add work worth showing off. Each CV picks the projects and the details within them.",
      action: "Add a project",
    },
  },
  volunteer: {
    path: "/inventory/volunteer",
    title: "Volunteer",
    description:
      "Unpaid roles, structured like Work — with responsibilities and highlights a CV can select from.",
    icon: HandHeartIcon,
    empty: {
      title: "No volunteer entries yet",
      body: "Add organisations you've given time to and what you did there.",
      action: "Add an entry",
    },
  },
  awards: {
    path: "/inventory/awards",
    title: "Awards",
    description:
      "Recognition you've received. CVs include or omit whole entries.",
    icon: AwardIcon,
    empty: {
      title: "No awards yet",
      body: "Add awards with the awarder and the date received.",
      action: "Add an award",
    },
  },
  certificates: {
    path: "/inventory/certificates",
    title: "Certificates",
    description:
      "Certifications and their issuers. CVs include or omit whole entries.",
    icon: ScrollTextIcon,
    empty: {
      title: "No certificates yet",
      body: "Add certifications along with who issued them and when.",
      action: "Add a certificate",
    },
  },
  publications: {
    path: "/inventory/publications",
    title: "Publications",
    description:
      "Papers, articles, and books you've published. CVs include or omit whole entries.",
    icon: NewspaperIcon,
    empty: {
      title: "No publications yet",
      body: "Add published work with its publisher and release date.",
      action: "Add a publication",
    },
  },
  interests: {
    path: "/inventory/interests",
    title: "Interests",
    description:
      "Interests and the keywords under each. CVs pick which interests appear and which keywords within them.",
    icon: HeartIcon,
    empty: {
      title: "No interests yet",
      body: "Add interests worth mentioning, each with its own keywords.",
      action: "Add an interest",
    },
  },
  references: {
    path: "/inventory/references",
    title: "References",
    description:
      "People who'll vouch for you and what they said. CVs include or omit whole entries.",
    icon: QuoteIcon,
    empty: {
      title: "No references yet",
      body: "Add referees and their reference text.",
      action: "Add a reference",
    },
  },
  importExport: {
    path: "/inventory/import-export",
    title: "Import / Export",
    description:
      "Import a resume.json to seed your Profile — only while it's empty. Export is always available.",
    icon: FileTextIcon,
    empty: {
      title: "Nothing to export yet",
      body: "Your Profile is empty, so this is the moment to import a resume.json if you have one.",
      action: "Import resume.json",
    },
  },
} satisfies Record<string, NavPage>

export type InventoryPageKey = keyof typeof inventoryPages

/** The Core / Additional split from the spec. Deliberately not a principled tiering — see Known weaknesses. */
export const inventoryGroups: {
  label: string
  pages: NavPage[]
}[] = [
  {
    label: "Core",
    pages: [
      inventoryPages.basics,
      inventoryPages.work,
      inventoryPages.education,
      inventoryPages.skills,
      inventoryPages.languages,
      inventoryPages.projects,
    ],
  },
  {
    label: "Additional",
    pages: [
      inventoryPages.volunteer,
      inventoryPages.awards,
      inventoryPages.certificates,
      inventoryPages.publications,
      inventoryPages.interests,
      inventoryPages.references,
    ],
  },
  {
    label: "Utility",
    pages: [inventoryPages.importExport],
  },
]

/** Top-level sections. Inventory is the only one with children. */
export const sections = {
  dashboard: {
    path: "/",
    title: "Dashboard",
    description:
      "Your pipeline at a glance — active applications and what needs attention.",
    icon: LayoutDashboardIcon,
    empty: {
      title: "Nothing in flight",
      body: "Once you start tracking applications, this is where you'll see what's moving.",
      action: "Track an application",
    },
  },
  inventory: {
    path: "/inventory",
    title: "Profile",
    description:
      "The raw material. Add everything you've ever done here — each CV selects from it, and none of it is sent to anyone.",
    icon: LayersIcon,
    empty: {
      title: "Your Profile is empty",
      body: "Start with Basics, then add the pools that matter for the roles you're chasing.",
      action: "Start with Basics",
    },
  },
  cvs: {
    path: "/cvs",
    title: "CVs",
    description:
      "Tailored documents, each composed by selecting entries and bullet points from your Profile.",
    icon: FileTextIcon,
    empty: {
      title: "No CVs yet",
      body: "A CV is a selection from your Profile, assembled for a specific role. Build one per application.",
      action: "Create a CV",
    },
  },
  templates: {
    path: "/templates",
    title: "Templates",
    description:
      "How a CV looks on the page. Pick the layout your CV is rendered and printed with — the content always comes from your Profile.",
    icon: LayoutTemplateIcon,
    empty: {
      title: "No templates available",
      body: "Templates control print layout only. They never change which entries or bullet points a CV includes.",
      action: "Browse templates",
    },
  },
  applications: {
    path: "/applications",
    title: "Applications",
    description:
      "The tracker. Jobs and their status over time, from before you apply through to the outcome.",
    icon: SendIcon,
    empty: {
      title: "No applications yet",
      body: "Track a job from the moment you spot it. When status becomes Applied, the CV you sent is frozen as a snapshot.",
      action: "Track a job",
    },
  },
  settings: {
    path: "/settings",
    title: "Settings",
    description: "Account, preferences, and export configuration.",
    icon: SettingsIcon,
    empty: {
      title: "Nothing to configure yet",
      body: "Account and export preferences will live here.",
      action: "Open account settings",
    },
  },
} satisfies Record<string, NavPage>

const allPages: NavPage[] = [
  ...Object.values(sections),
  ...Object.values(inventoryPages),
]

export function findPageByPath(pathname: string): NavPage | undefined {
  return allPages.find((page) => page.path === pathname)
}

/**
 * Breadcrumb trail for a route: `/inventory/work` → [Inventory, Work].
 * Only Inventory nests, so the trail is at most two deep.
 */
export function getBreadcrumbTrail(pathname: string): NavPage[] {
  const page = findPageByPath(pathname)

  if (!page) {
    return []
  }

  if (page.path.startsWith("/inventory/")) {
    return [sections.inventory, page]
  }

  return [page]
}
