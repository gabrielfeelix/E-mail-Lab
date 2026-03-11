function readEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()

    if (value) {
      return value
    }
  }

  return ''
}

export function getSupabaseServerConfig() {
  const supabaseUrl = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const supabaseKey = readEnv('SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_PUBLISHABLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    const missing = [
      !supabaseUrl && 'SUPABASE_URL ou VITE_SUPABASE_URL',
      !supabaseKey && 'SUPABASE_PUBLISHABLE_KEY ou SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY',
    ].filter(Boolean)

    return {
      error: `Configure ${missing.join(', ')} no servidor.`,
      supabaseKey: '',
      supabaseUrl: '',
    }
  }

  return {
    error: null,
    supabaseKey,
    supabaseUrl,
  }
}
