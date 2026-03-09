import { createClient } from '@supabase/supabase-js'
import juice from 'juice'
import nodemailer from 'nodemailer'

const DEFAULT_SUPABASE_URL = 'https://mejsihwvvpcmiktjnnpx.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IuSuAC__d87fbwdPtybqsw_o6YYckvx'
const DOCTYPE = '<!doctype html>'
const BASE_STYLE_MARKER = 'data-email-lab-base'
const SAFE_BASE_STYLE =
  'html,body{margin:0;padding:0;max-width:100%;overflow-x:hidden;background:#ffffff;color:#111827;-webkit-font-smoothing:antialiased;}body,table,tbody,tr,td,div,p,span,a,strong,em{max-width:100%;overflow-wrap:anywhere;word-break:break-word;}table{width:100%;max-width:100%!important;border-collapse:collapse;table-layout:fixed;}img{display:block;max-width:100%!important;height:auto!important;border:0;}a{text-decoration:none;}'
const STYLE_BLOCK_PATTERN = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi

function readEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()

    if (value) {
      return value
    }
  }

  return ''
}

function stripScripts(markup) {
  return String(markup || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function ensureBaseStyle(markup) {
  if (markup.includes(BASE_STYLE_MARKER)) {
    return markup
  }

  const styleTag = `<style ${BASE_STYLE_MARKER}>${SAFE_BASE_STYLE}</style>`

  if (/<\/head>/i.test(markup)) {
    return markup.replace(/<\/head>/i, `${styleTag}</head>`)
  }

  if (/<html[\s>]/i.test(markup)) {
    return markup.replace(
      /<html([^>]*)>/i,
      `<html$1><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />${styleTag}</head>`,
    )
  }

  return `${DOCTYPE}<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />${styleTag}</head><body>${markup}</body></html>`
}

function wrapMarkupFragment(markup) {
  const styleBlocks = markup.match(STYLE_BLOCK_PATTERN) ?? []
  const content = markup.replace(STYLE_BLOCK_PATTERN, '').trim()

  return `${DOCTYPE}<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style ${BASE_STYLE_MARKER}>${SAFE_BASE_STYLE}</style>${styleBlocks.join('\n')}</head><body>${content}</body></html>`
}

function buildEmailDocument(markup) {
  const safeMarkup = stripScripts(String(markup || '').trim())
  const isFullDocument = /<!doctype|<html[\s>]|<body[\s>]/i.test(safeMarkup)

  if (!safeMarkup) {
    return ensureBaseStyle('')
  }

  return isFullDocument ? ensureBaseStyle(safeMarkup) : wrapMarkupFragment(safeMarkup)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Metodo nao permitido.' })
    return
  }

  const authHeader = String(req.headers.authorization || '')
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    res.status(401).json({ ok: false, message: 'Sessao ausente para envio de teste.' })
    return
  }

  const supabaseUrl = readEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL
  const supabaseKey = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') || DEFAULT_SUPABASE_PUBLISHABLE_KEY
  const smtpHost = readEnv('SMTP_HOST')
  const smtpPort = Number(readEnv('SMTP_PORT') || '587')
  const smtpUser = readEnv('SMTP_USER')
  const smtpPass = readEnv('SMTP_PASS')
  const smtpFrom = readEnv('EMAIL_LAB_TEST_FROM', 'SMTP_FROM')
  const smtpSecure = readEnv('SMTP_SECURE') === 'true' || smtpPort === 465

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    const missing = [
      !smtpHost && 'SMTP_HOST',
      !smtpUser && 'SMTP_USER',
      !smtpPass && 'SMTP_PASS',
      !smtpFrom && 'EMAIL_LAB_TEST_FROM',
    ].filter(Boolean)
    res.status(500).json({
      ok: false,
      message: `Configure ${missing.join(', ')} no servidor.`,
    })
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
    res.status(401).json({ ok: false, message: 'Sessao invalida para envio de teste.' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const toEmail = String(body.toEmail || '').trim().toLowerCase()
  const companyId = String(body.companyId || '').trim()
  const subject = String(body.subject || '').trim()
  const markup = String(body.markup || '')

  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    res.status(400).json({ ok: false, message: 'Informe um email valido para o teste.' })
    return
  }

  if (!companyId) {
    res.status(400).json({ ok: false, message: 'Empresa do template nao informada.' })
    return
  }

  if (!markup.trim()) {
    res.status(400).json({ ok: false, message: 'O template esta vazio. Salve ou gere um markup antes de enviar.' })
    return
  }

  const companyResult = await client.from('companies').select('id, name').eq('id', companyId).maybeSingle()
  if (companyResult.error || !companyResult.data?.id) {
    res.status(403).json({ ok: false, message: 'Voce nao tem acesso a esta empresa para envio de teste.' })
    return
  }

  const html = juice(buildEmailDocument(markup), {
    applyStyleTags: true,
    inlinePseudoElements: false,
    preserveFontFaces: true,
    preserveImportant: true,
    preserveMediaQueries: true,
    removeStyleTags: false,
  })

  const transporter = nodemailer.createTransport({
    auth: {
      pass: smtpPass,
      user: smtpUser,
    },
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
  })

  await transporter.sendMail({
    from: smtpFrom,
    html,
    subject: `[TESTE] ${subject || `Template ${companyResult.data.name}`}`,
    to: toEmail,
  })

  res.status(200).json({ ok: true, message: 'Email de teste enviado.' })
}
