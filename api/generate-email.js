function extractMarkup(text) {
  const normalized = String(text || '').trim()

  if (!normalized) {
    return ''
  }

  const fencedMatch = normalized.match(/```(?:html)?\s*([\s\S]*?)```/i)
  return (fencedMatch ? fencedMatch[1] : normalized).trim()
}

function buildPrompt(body) {
  const sections = [
    `Empresa: ${body.companyName}`,
    `Template: ${body.templateName}`,
    `Assunto: ${body.subject}`,
    `Categoria: ${body.category}`,
    `Briefing: ${body.brief}`,
  ]

  if (body.favoriteHeader?.markup) {
    sections.push(`Header base para usar e preservar:\n${body.favoriteHeader.markup}`)
  }

  if (body.favoriteFooter?.markup) {
    sections.push(`Footer base para usar e preservar:\n${body.favoriteFooter.markup}`)
  }

  if (body.brandProfile) {
    sections.push(
      [
        'Identidade visual da marca:',
        `Logo: ${body.brandProfile.logoUrl || 'nao informada'}`,
        `Cor primaria: ${body.brandProfile.primaryColor || 'nao informada'}`,
        `Cor secundaria: ${body.brandProfile.secondaryColor || 'nao informada'}`,
        `Background: ${body.brandProfile.backgroundColor || 'nao informado'}`,
        `Tipografia: ${body.brandProfile.typography || 'nao informada'}`,
        `Diretrizes: ${body.brandProfile.additionalContext || 'nenhuma adicional'}`,
      ].join('\n'),
    )

    if (String(body.brandProfile.exampleMarkup || '').trim()) {
      sections.push(`Exemplo de email da marca:\n${body.brandProfile.exampleMarkup}`)
    }

    if (String(body.brandProfile.referenceImageName || '').trim()) {
      sections.push(`Imagem de referencia enviada: ${body.brandProfile.referenceImageName}`)
    }
  }

  sections.push(
    [
      'Gere um email HTML completo em pt-BR para uso real em email marketing.',
      'Retorne apenas o markup final, sem markdown, sem explicacoes e sem blocos de codigo.',
      'Nao use JavaScript, formularios, video ou elementos inseguros para email.',
      'Pode usar <style> no documento, mas mantenha compatibilidade com clientes de email.',
      'Use layout responsivo, largura segura de 600px no desktop e estrutura clara para mobile.',
      'Se header e footer foram enviados, mantenha esses blocos como base do resultado.',
    ].join(' '),
  )

  return sections.join('\n\n')
}

function buildImagePart(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    return null
  }

  return {
    inline_data: {
      data: match[2],
      mime_type: match[1],
    },
  }
}

const GENERATION_TIMEOUT_MS = 45000

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Metodo nao permitido.' })
    return
  }

  const apiKey = String(
    process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      '',
  ).trim()
  const model = String(
    process.env.GEMINI_MODEL ||
      process.env.GOOGLE_MODEL ||
      process.env.VITE_GEMINI_MODEL ||
      'gemini-3-flash-preview',
  ).trim()
  const thinkingLevel = String(
    process.env.GEMINI_THINKING_LEVEL ||
      process.env.GOOGLE_THINKING_LEVEL ||
      process.env.VITE_GEMINI_THINKING_LEVEL ||
      'minimal',
  ).trim()

  if (!apiKey) {
    res.status(500).json({ ok: false, message: 'GEMINI_API_KEY nao configurada no servidor.' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const imagePart = buildImagePart(body?.brandProfile?.referenceImageData)

  if (!String(body.brief || '').trim()) {
    res.status(400).json({ ok: false, message: 'Informe o briefing do email.' })
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

  let response
  let payload

  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildPrompt(body),
                },
                ...(imagePart ? [imagePart] : []),
              ],
              role: 'user',
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.4,
            thinkingConfig: {
              thinkingLevel,
            },
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      },
    )

    payload = await response.json().catch(() => ({}))
  } catch (error) {
    if (error?.name === 'AbortError') {
      res.status(504).json({
        ok: false,
        message: 'A IA demorou demais para responder. Tente um briefing mais objetivo ou gere novamente.',
      })
      return
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    res.status(response.status).json({
      ok: false,
      message:
        payload?.error?.message ||
        payload?.message ||
        'Gemini nao conseguiu gerar o email.',
    })
    return
  }

  const parts = payload?.candidates?.[0]?.content?.parts || []
  const text = parts.map((part) => String(part?.text || '')).join('\n')
  const markup = extractMarkup(text)

  if (!markup) {
    res.status(502).json({ ok: false, message: 'Gemini respondeu sem markup utilizavel.' })
    return
  }

  res.status(200).json({ ok: true, markup })
}
