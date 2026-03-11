import { createClient } from '@supabase/supabase-js'
import { buildReadinessReport } from './_email-deliverability.js'
import { getSupabaseServerConfig } from './_supabase-config.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, message: 'Metodo nao permitido.' })
    return
  }

  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    res.status(401).json({ ok: false, message: 'Sessao ausente para diagnostico.' })
    return
  }

  const companyId = String(req.query.companyId || '').trim()

  if (!companyId) {
    res.status(400).json({ ok: false, message: 'Informe companyId para diagnostico.' })
    return
  }

  const { error: supabaseConfigError, supabaseKey, supabaseUrl } = getSupabaseServerConfig()

  if (supabaseConfigError) {
    res.status(500).json({ ok: false, message: supabaseConfigError })
    return
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const userResult = await client.auth.getUser(token)
  if (userResult.error || !userResult.data.user) {
    res.status(401).json({ ok: false, message: 'Sessao invalida para diagnostico.' })
    return
  }

  const companyResult = await client.from('companies').select('id, name').eq('id', companyId).maybeSingle()
  if (companyResult.error || !companyResult.data?.id) {
    res.status(403).json({ ok: false, message: 'Voce nao tem acesso a esta empresa.' })
    return
  }

  try {
    res.status(200).json({
      ok: true,
      report: buildReadinessReport(companyResult.data.id, companyResult.data.name),
    })
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Configuracao de entregabilidade invalida.',
    })
  }
}
