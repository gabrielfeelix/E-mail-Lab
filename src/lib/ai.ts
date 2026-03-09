import type { SectionRecord } from '../types/section'

type GenerateEmailMarkupInput = {
  brief: string
  category: string
  companyName: string
  favoriteFooter: SectionRecord | null
  favoriteHeader: SectionRecord | null
  subject: string
  templateName: string
}

type GenerateEmailMarkupResponse = {
  error?: string
  markup?: string
  message?: string
  ok?: boolean
}

const browserGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim()
const browserGeminiModel = (import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite').trim()

function buildPrompt(input: GenerateEmailMarkupInput) {
  const sections = [
    `Empresa: ${input.companyName}`,
    `Template: ${input.templateName}`,
    `Assunto: ${input.subject}`,
    `Categoria: ${input.category}`,
    `Briefing: ${input.brief}`,
  ]

  if (input.favoriteHeader?.markup) {
    sections.push(`Header base para usar e preservar:\n${input.favoriteHeader.markup}`)
  }

  if (input.favoriteFooter?.markup) {
    sections.push(`Footer base para usar e preservar:\n${input.favoriteFooter.markup}`)
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

function extractMarkup(text: string) {
  const normalized = text.trim()

  if (!normalized) {
    return ''
  }

  const fencedMatch = normalized.match(/```(?:html)?\s*([\s\S]*?)```/i)
  return (fencedMatch?.[1] || normalized).trim()
}

async function generateEmailMarkupInBrowser(input: GenerateEmailMarkupInput) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${browserGeminiModel}:generateContent?key=${browserGeminiKey}`,
    {
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildPrompt(input),
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
    throw new Error(payload?.error?.message || payload?.message || 'Gemini nao conseguiu gerar o email.')
  }

  const parts = payload?.candidates?.[0]?.content?.parts || []
  const markup = extractMarkup(parts.map((part: { text?: string }) => String(part?.text || '')).join('\n'))

  if (!markup) {
    throw new Error('Gemini respondeu sem markup utilizavel.')
  }

  return markup
}

export async function generateEmailMarkup(input: GenerateEmailMarkupInput) {
  try {
    const response = await fetch('/api/generate-email', {
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const payload = (await response.json().catch(() => ({}))) as GenerateEmailMarkupResponse

    if (!response.ok || !payload.ok || !payload.markup) {
      throw new Error(payload.message || 'Nao foi possivel gerar o email com Gemini.')
    }

    return payload.markup
  } catch (error) {
    if (import.meta.env.DEV && browserGeminiKey) {
      return generateEmailMarkupInBrowser(input)
    }

    throw error
  }
}
