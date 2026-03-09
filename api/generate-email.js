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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Metodo nao permitido.' })
    return
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim()
  const model = String(process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite').trim()

  if (!apiKey) {
    res.status(500).json({ ok: false, message: 'GEMINI_API_KEY nao configurada no servidor.' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

  if (!String(body.brief || '').trim()) {
    res.status(400).json({ ok: false, message: 'Informe o briefing do email.' })
    return
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(body),
              },
            ],
            role: 'user',
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.6,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  )

  const payload = await response.json().catch(() => ({}))

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
