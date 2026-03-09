import type { BrandProfileRecord } from '../types/brand-profile'
import type { SectionRecord } from '../types/section'

type GenerateEmailMarkupInput = {
  brief: string
  brandProfile: BrandProfileRecord | null
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
const browserGeminiModel = (import.meta.env.VITE_GEMINI_MODEL || 'gemini-3-flash-preview').trim()
const browserGeminiThinkingLevel = (import.meta.env.VITE_GEMINI_THINKING_LEVEL || 'minimal').trim()
const GENERATION_TIMEOUT_MS = 45000

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

  if (input.brandProfile) {
    sections.push(
      [
        `Identidade visual da marca:`,
        `Logo: ${input.brandProfile.logoUrl || 'nao informada'}`,
        `Cor primaria: ${input.brandProfile.primaryColor || 'nao informada'}`,
        `Cor secundaria: ${input.brandProfile.secondaryColor || 'nao informada'}`,
        `Background: ${input.brandProfile.backgroundColor || 'nao informado'}`,
        `Tipografia: ${input.brandProfile.typography || 'nao informada'}`,
        `Diretrizes: ${input.brandProfile.additionalContext || 'nenhuma adicional'}`,
      ].join('\n'),
    )

    if (input.brandProfile.exampleMarkup.trim()) {
      sections.push(`Exemplo de email da marca:\n${input.brandProfile.exampleMarkup}`)
    }

    if (input.brandProfile.referenceImageName.trim()) {
      sections.push(`Imagem de referencia enviada: ${input.brandProfile.referenceImageName}`)
    }
  }

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
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS)

  try {
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
            maxOutputTokens: 4096,
            temperature: 0.4,
            thinkingConfig: {
              thinkingLevel: browserGeminiThinkingLevel,
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
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('A IA demorou demais para responder. Tente um briefing mais objetivo ou gere novamente.')
    }

    throw error
  } finally {
    window.clearTimeout(timeout)
  }
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
