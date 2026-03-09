import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null
const DEFAULT_SUPABASE_URL = 'https://mejsihwvvpcmiktjnnpx.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IuSuAC__d87fbwdPtybqsw_o6YYckvx'

function readEnvValue(value: string | undefined) {
  return value?.trim() || ''
}

export const supabaseUrl = readEnvValue(import.meta.env.VITE_SUPABASE_URL) || DEFAULT_SUPABASE_URL
export const supabasePublishableKey =
  readEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || DEFAULT_SUPABASE_PUBLISHABLE_KEY

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
