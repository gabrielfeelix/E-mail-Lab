const DOCTYPE = '<!doctype html>'
const BASE_STYLE_MARKER = 'data-email-lab-base'
const SAFE_BASE_STYLE = `body{margin:0;padding:0;background:#ffffff;color:#111827;-webkit-font-smoothing:antialiased;}img{max-width:100%;height:auto;border:0;}table{border-collapse:collapse;}a{text-decoration:none;}`
const STYLE_BLOCK_PATTERN = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi

function stripScripts(markup: string) {
  return markup
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function ensureBaseStyle(markup: string) {
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

function wrapMarkupFragment(markup: string) {
  const styleBlocks = markup.match(STYLE_BLOCK_PATTERN) ?? []
  const content = markup.replace(STYLE_BLOCK_PATTERN, '').trim()

  return `${DOCTYPE}<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style ${BASE_STYLE_MARKER}>${SAFE_BASE_STYLE}</style>${styleBlocks.join('\n')}</head><body>${content}</body></html>`
}

export function buildEmailDocument(markup: string) {
  const safeMarkup = stripScripts(markup.trim())
  const isFullDocument = /<!doctype|<html[\s>]|<body[\s>]/i.test(safeMarkup)

  if (!safeMarkup) {
    return ensureBaseStyle('')
  }

  return isFullDocument ? ensureBaseStyle(safeMarkup) : wrapMarkupFragment(safeMarkup)
}

export function buildEmailDocumentFromParts(html: string, css: string) {
  const safeHtml = stripScripts(html.trim())
  const safeCss = css.trim()
  return buildEmailDocument(`${safeCss ? `<style>${safeCss}</style>\n` : ''}${safeHtml}`)
}

export async function inlineEmailDocument(markup: string) {
  const document = buildEmailDocument(markup)

  try {
    const { default: juiceClient } = await import('juice/client')
    return juiceClient(document, {
      applyStyleTags: true,
      inlinePseudoElements: false,
      preserveFontFaces: true,
      preserveImportant: true,
      preserveMediaQueries: true,
      removeStyleTags: false,
    })
  } catch {
    return document
  }
}

export function describeMarkup(markup: string) {
  const lines = markup.split('\n').length
  const hasMediaQuery = /@media/i.test(markup)
  const hasStyleTag = /<style[\s>]/i.test(markup)

  return {
    hasMediaQuery,
    hasStyleTag,
    lines,
  }
}
