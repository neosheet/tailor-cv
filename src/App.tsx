import { BrowserRouter, Route, Routes } from "react-router"

import { AppLayout } from "@/components/layout/app-layout"
import { ApplicationsPage } from "@/pages/applications"
import { CvPrintPage } from "@/pages/cv-print"
import { CvsPage } from "@/pages/cvs"
import { DashboardPage } from "@/pages/dashboard"
import { NotFoundPage } from "@/pages/not-found"
import { SettingsPage } from "@/pages/settings"
import { TemplatesPage } from "@/pages/templates"
import { AwardsPage } from "@/pages/inventory/awards"
import { BasicsPage } from "@/pages/inventory/basics"
import { CertificatesPage } from "@/pages/inventory/certificates"
import { EducationPage } from "@/pages/inventory/education"
import { ImportExportPage } from "@/pages/inventory/import-export"
import { InterestsPage } from "@/pages/inventory/interests"
import { InventoryIndexPage } from "@/pages/inventory"
import { LanguagesPage } from "@/pages/inventory/languages"
import { ProjectsPage } from "@/pages/inventory/projects"
import { PublicationsPage } from "@/pages/inventory/publications"
import { ReferencesPage } from "@/pages/inventory/references"
import { SkillsPage } from "@/pages/inventory/skills"
import { VolunteerPage } from "@/pages/inventory/volunteer"
import { WorkPage } from "@/pages/inventory/work"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />

          <Route path="inventory">
            <Route index element={<InventoryIndexPage />} />
            <Route path="basics" element={<BasicsPage />} />
            <Route path="work" element={<WorkPage />} />
            <Route path="education" element={<EducationPage />} />
            <Route path="skills" element={<SkillsPage />} />
            <Route path="languages" element={<LanguagesPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="volunteer" element={<VolunteerPage />} />
            <Route path="awards" element={<AwardsPage />} />
            <Route path="certificates" element={<CertificatesPage />} />
            <Route path="publications" element={<PublicationsPage />} />
            <Route path="interests" element={<InterestsPage />} />
            <Route path="references" element={<ReferencesPage />} />
            <Route path="import-export" element={<ImportExportPage />} />
          </Route>

          <Route path="cvs" element={<CvsPage />} />
          <Route path="cvs/:cvId/print" element={<CvPrintPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="settings" element={<SettingsPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
