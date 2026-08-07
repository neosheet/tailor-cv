import { BrowserRouter, Navigate, Route, Routes } from "react-router"

import { AppLayout } from "@/components/layout/app-layout"
import { ApplicationsPage } from "@/pages/applications"
import { CvPage } from "@/pages/cv"
import { CvPrintPage } from "@/pages/cv-print"
import { DashboardPage } from "@/pages/dashboard"
import { LoginPage } from "@/pages/login"
import { NotFoundPage } from "@/pages/not-found"
import { PersonaDetailPage } from "@/pages/persona-detail"
import { PersonasPage } from "@/pages/personas"
import { SettingsPage } from "@/pages/settings"
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
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { InventoryStoreProvider } from "@/lib/inventory-store"
import { PersonaStoreProvider } from "@/lib/persona-store"

function RequireAuth() {
  const { session, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return (
    <InventoryStoreProvider>
      <PersonaStoreProvider>
        <AppLayout />
      </PersonaStoreProvider>
    </InventoryStoreProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
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

            <Route path="personas" element={<PersonasPage />} />
            <Route path="personas/:id" element={<PersonaDetailPage />} />
            <Route path="cvs" element={<CvPage />} />
            <Route path="cvs/:cvId/print" element={<CvPrintPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="settings" element={<SettingsPage />} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
