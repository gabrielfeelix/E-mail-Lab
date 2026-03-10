function readEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim()

    if (value) {
      return value
    }
  }

  return ''
}

function parseJsonEnv(name) {
  const rawValue = readEnv(name)

  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new Error(`${name} precisa ser um JSON valido.`)
  }
}

function parseMailbox(value) {
  const source = String(value || '').trim()
  const match = source.match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i)

  if (!match) {
    return ''
  }

  return match[1].toLowerCase()
}

function getDomainFromMailbox(value) {
  const mailbox = parseMailbox(value)
  return mailbox.includes('@') ? mailbox.split('@')[1] : ''
}

function normalizePrivateKey(value) {
  return String(value || '').replace(/\\n/g, '\n').trim()
}

function replaceTokens(template, payload) {
  return String(template || '').replace(/\{\{\s*(email|companyId|companyName)\s*\}\}/gi, (_, token) => {
    const key = token.toLowerCase()

    if (key === 'email') {
      return encodeURIComponent(payload.email)
    }

    if (key === 'companyid') {
      return encodeURIComponent(payload.companyId)
    }

    return encodeURIComponent(payload.companyName)
  })
}

export function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<\/(p|div|section|article|header|footer|li|tr|table|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function resolveDeliverabilityConfig(companyId, companyName) {
  const globalConfig = {
    bounceAddress: readEnv('EMAIL_LAB_BOUNCE_ADDRESS'),
    dkimDomainName: readEnv('EMAIL_DKIM_DOMAIN_NAME'),
    dkimKeySelector: readEnv('EMAIL_DKIM_KEY_SELECTOR'),
    dkimPrivateKey: normalizePrivateKey(readEnv('EMAIL_DKIM_PRIVATE_KEY')),
    from: readEnv('EMAIL_LAB_TEST_FROM', 'SMTP_FROM'),
    listId: readEnv('EMAIL_LAB_LIST_ID'),
    listIdDomain: readEnv('EMAIL_LAB_LIST_ID_DOMAIN'),
    replyTo: readEnv('EMAIL_LAB_REPLY_TO'),
    unsubscribeMailto: readEnv('EMAIL_LAB_UNSUBSCRIBE_MAILTO'),
    unsubscribeUrl: readEnv('EMAIL_LAB_UNSUBSCRIBE_URL'),
  }
  const companyMap = parseJsonEnv('EMAIL_LAB_COMPANY_SENDER_MAP')
  const companyConfig = companyMap[companyId] && typeof companyMap[companyId] === 'object' ? companyMap[companyId] : {}

  const resolved = {
    bounceAddress: String(companyConfig.bounceAddress || globalConfig.bounceAddress || '').trim(),
    dkimDomainName: String(companyConfig.dkimDomainName || globalConfig.dkimDomainName || '').trim(),
    dkimKeySelector: String(companyConfig.dkimKeySelector || globalConfig.dkimKeySelector || '').trim(),
    dkimPrivateKey: normalizePrivateKey(companyConfig.dkimPrivateKey || globalConfig.dkimPrivateKey || ''),
    from: String(companyConfig.from || globalConfig.from || '').trim(),
    listId: String(companyConfig.listId || globalConfig.listId || '').trim(),
    listIdDomain: String(companyConfig.listIdDomain || globalConfig.listIdDomain || '').trim(),
    replyTo: String(companyConfig.replyTo || globalConfig.replyTo || '').trim(),
    unsubscribeMailto: String(companyConfig.unsubscribeMailto || globalConfig.unsubscribeMailto || '').trim(),
    unsubscribeUrl: String(companyConfig.unsubscribeUrl || globalConfig.unsubscribeUrl || '').trim(),
  }

  const fromDomain = getDomainFromMailbox(resolved.from)
  const replyToDomain = getDomainFromMailbox(resolved.replyTo)
  const bounceDomain = getDomainFromMailbox(resolved.bounceAddress)
  const listIdDomain = resolved.listIdDomain || fromDomain
  const warnings = []

  if (!resolved.from) {
    warnings.push('Defina EMAIL_LAB_TEST_FROM ou um from especifico por empresa.')
  }

  if (!resolved.replyTo) {
    warnings.push('Defina EMAIL_LAB_REPLY_TO para evitar replies perdidos.')
  }

  if (!resolved.bounceAddress) {
    warnings.push('Defina EMAIL_LAB_BOUNCE_ADDRESS para separar o envelope-from do cabecalho From.')
  }

  if (!resolved.unsubscribeUrl && !resolved.unsubscribeMailto) {
    warnings.push('Defina EMAIL_LAB_UNSUBSCRIBE_URL ou EMAIL_LAB_UNSUBSCRIBE_MAILTO para suportar List-Unsubscribe.')
  }

  if (!resolved.dkimDomainName || !resolved.dkimKeySelector || !resolved.dkimPrivateKey) {
    warnings.push('Configure DKIM no provedor SMTP ou preencha EMAIL_DKIM_* para assinatura no app.')
  }

  if (fromDomain && replyToDomain && fromDomain !== replyToDomain) {
    warnings.push('From e Reply-To estao em dominios diferentes; alinhe se isso nao for intencional.')
  }

  if (fromDomain && bounceDomain && fromDomain !== bounceDomain) {
    warnings.push('From e envelope-from estao em dominios diferentes; confirme se o provedor esta autenticando ambos.')
  }

  return {
    ...resolved,
    dkim: resolved.dkimDomainName && resolved.dkimKeySelector && resolved.dkimPrivateKey
      ? {
          domainName: resolved.dkimDomainName,
          keySelector: resolved.dkimKeySelector,
          privateKey: resolved.dkimPrivateKey,
        }
      : undefined,
    domains: {
      bounce: bounceDomain,
      from: fromDomain,
      listId: listIdDomain,
      replyTo: replyToDomain,
    },
    inferredListId: resolved.listId || `${companyId}.${listIdDomain || fromDomain || 'email-lab.local'}`,
    warnings,
  }
}

export function buildRecipientHeaders(config, company, recipientEmail) {
  const unsubscribeParts = []

  if (config.unsubscribeMailto) {
    unsubscribeParts.push(`<${replaceTokens(config.unsubscribeMailto, {
      companyId: company.id,
      companyName: company.name,
      email: recipientEmail,
    })}>`)
  }

  if (config.unsubscribeUrl) {
    unsubscribeParts.push(`<${replaceTokens(config.unsubscribeUrl, {
      companyId: company.id,
      companyName: company.name,
      email: recipientEmail,
    })}>`)
  }

  const headers = {
    'Feedback-ID': `${company.id}:email-lab:test`,
    'List-ID': config.inferredListId,
    'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
  }

  if (unsubscribeParts.length > 0) {
    headers['List-Unsubscribe'] = unsubscribeParts.join(', ')
  }

  if (config.unsubscribeUrl) {
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  return headers
}

export function buildReadinessReport(companyId, companyName) {
  const config = resolveDeliverabilityConfig(companyId, companyName)

  return {
    checks: {
      bounceAddress: Boolean(config.bounceAddress),
      companySpecificSender: Boolean(parseJsonEnv('EMAIL_LAB_COMPANY_SENDER_MAP')[companyId]),
      dkim: Boolean(config.dkim),
      from: Boolean(config.from),
      listHeaders: Boolean(config.unsubscribeUrl || config.unsubscribeMailto),
      replyTo: Boolean(config.replyTo),
      smtp: Boolean(readEnv('SMTP_HOST') && readEnv('SMTP_PORT') && readEnv('SMTP_USER') && readEnv('SMTP_PASS')),
    },
    company: {
      id: companyId,
      name: companyName,
    },
    configPreview: {
      bounceAddress: config.bounceAddress || null,
      from: config.from || null,
      inferredListId: config.inferredListId,
      replyTo: config.replyTo || null,
      unsubscribeMailto: config.unsubscribeMailto || null,
      unsubscribeUrl: config.unsubscribeUrl || null,
    },
    guidance: [
      'Publique SPF para o dominio do envelope-from.',
      'Publique DKIM para o dominio do From.',
      'Publique DMARC com alinhamento do dominio do From.',
      'Use um subdominio dedicado para marketing/bulk.',
      'Monitore Google Postmaster Tools antes de escalar volume.',
    ],
    warnings: config.warnings,
  }
}
