import { createClient } from "@supabase/supabase-js"
// Reuses the root app's generated types for insert type-safety — same
// Supabase project, same schema, no reason to duplicate the codegen output
// for the extension.
import type { Database } from "../../../src/lib/database.types"

import { chromeStorageAdapter } from "./chrome-storage-adapter"

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      // No OAuth redirect flow here — email/password only.
      detectSessionInUrl: false,
    },
  }
)
