import { AddApplicationView } from "@/components/add-application-view"
import { LoginView } from "@/components/login-view"
import { Button } from "@/components/ui/button"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"

function SignedInView() {
  const { session } = useAuth()

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm text-muted-foreground">
          Signed in as {session?.user.email}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </Button>
      </div>
      <AddApplicationView />
    </div>
  )
}

function AppShell() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading…</p>
    )
  }

  return session ? <SignedInView /> : <LoginView />
}

function App() {
  return (
    <div className="flex min-h-40 w-80 flex-col gap-2 bg-background p-4 text-foreground">
      <h1 className="text-lg font-semibold">tailor-cv quick add</h1>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </div>
  )
}

export default App
