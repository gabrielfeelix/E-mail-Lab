import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

function readEnvValue(value: string | undefined) {
  return value?.trim() || ''
}

export const supabaseUrl = readEnvValue(import.meta.env.VITE_SUPABASE_URL)
export const supabasePublishableKey = readEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey)
}

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig()) {
    return null
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  }

  return browserClient
}
