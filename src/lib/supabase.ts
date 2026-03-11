import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null
const REQUIRED_SUPABASE_ENV_NAMES = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const

function readEnvValue(value: string | undefined) {
  return value?.trim() || ''
}

export const supabaseUrl = readEnvValue(import.meta.env.VITE_SUPABASE_URL)
export const supabasePublishableKey = readEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey)
}

export function getSupabaseConfigError() {
  if (hasSupabaseConfig()) {
    return null
  }

  return `Configuracao ausente do Supabase. Defina ${REQUIRED_SUPABASE_ENV_NAMES.join(' e ')}.`
}

export function getSupabaseBrowserClient() {
  const configError = getSupabaseConfigError()

  if (configError) {
    throw new Error(configError)
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  }

  return browserClient
}
