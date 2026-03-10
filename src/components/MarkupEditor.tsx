import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

type EditorSelectionSnapshot = {
  end: number
  scrollLeft: number
  scrollTop: number
  start: number
}

type MarkupEditorProps = {
  onChange: (value: string, selection: EditorSelectionSnapshot) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function highlightCssFragment(value: string) {
  let html = escapeHtml(value)

  html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="editor-token editor-token--comment">$1</span>')
  html = html.replace(/([.#]?[A-Za-z_][\w:-]*)(\s*\{)/g, '<span class="editor-token editor-token--selector">$1</span>$2')
  html = html.replace(/([a-z-]+)(\s*:)/gi, '<span class="editor-token editor-token--property">$1</span>$2')
  html = html.replace(
    /(#(?:[0-9a-fA-F]{3,8})\b|(?:\d+|\d*\.\d+)(?:px|em|rem|vh|vw|%|fr)?\b|rgba?\([^)]+\)|hsla?\([^)]+\)|\b[a-z-]+\b(?=\s*[;,)]))/g,
    '<span class="editor-token editor-token--value">$1</span>',
  )

  return html
}

function highlightAttributeChunk(value: string) {
  return escapeHtml(value).replace(
    /([:@A-Za-z0-9._-]+)(\s*=\s*)(&quot;.*?&quot;|&#39;.*?&#39;|[^\s"'=<>`]+)/g,
    '<span class="editor-token editor-token--attr">$1</span>$2<span class="editor-token editor-token--string">$3</span>',
  )
}

function highlightTag(value: string) {
  const match = value.match(/^<(\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?)>$/)

  if (!match) {
    return `<span class="editor-token editor-token--tag">${escapeHtml(value)}</span>`
  }

  const closeSlash = match[1] ?? ''
  const tagName = match[2] ?? ''
  const attributes = match[3] ?? ''
  const selfClosingSlash = match[4] ?? ''
  const leading = `&lt;${closeSlash}`
  const trailing = `${selfClosingSlash}&gt;`

  return [
    `<span class="editor-token editor-token--tag">${leading}</span>`,
    `<span class="editor-token editor-token--tag-name">${escapeHtml(tagName)}</span>`,
    highlightAttributeChunk(attributes),
    `<span class="editor-token editor-token--tag">${trailing}</span>`,
  ].join('')
}

function highlightMarkup(value: string) {
  const parts = value.split(/(\{\{[\s\S]*?\}\}|<!--[\s\S]*?-->|<\/?[^>]+>)/g)
  let inStyle = false

  return parts
    .map((part) => {
      if (!part) {
        return ''
      }

      if (part.startsWith('{{') && part.endsWith('}}')) {
        return `<span class="editor-token editor-token--variable">${escapeHtml(part)}</span>`
      }

      if (part.startsWith('<!--') && part.endsWith('-->')) {
        return `<span class="editor-token editor-token--comment">${escapeHtml(part)}</span>`
      }

      if (part.startsWith('<') && part.endsWith('>')) {
        const highlighted = highlightTag(part)
        const normalized = part.toLowerCase()

        if (normalized.startsWith('<style')) {
          inStyle = true
        }

        if (normalized.startsWith('</style')) {
          inStyle = false
        }

        return highlighted
      }

      return inStyle ? highlightCssFragment(part) : escapeHtml(part)
    })
    .join('')
}

export function MarkupEditor(props: MarkupEditorProps) {
  const { onChange, textareaRef, value } = props
  const highlightInnerRef = useRef<HTMLPreElement | null>(null)
  const gutterInnerRef = useRef<HTMLDivElement | null>(null)
  const [activeLineHeight, setActiveLineHeight] = useState(24)
  const [activeLineTop, setActiveLineTop] = useState(14)
  const highlightedMarkup = useMemo(() => highlightMarkup(value), [value])
  const lineNumbers = useMemo(() => {
    const count = Math.max(value.split('\n').length, 1)
    return Array.from({ length: count }, (_, index) => index + 1)
  }, [value])

  useEffect(() => {
    const textarea = textareaRef.current

    if (!textarea) {
      return
    }

    const sync = () => {
      const styles = window.getComputedStyle(textarea)
      const paddingTop = Number.parseFloat(styles.paddingTop) || 0
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24
      const selectionStart = textarea.selectionStart ?? 0
      const nextLine = Math.max(value.slice(0, selectionStart).split('\n').length - 1, 0)

      setActiveLineHeight(lineHeight)
      setActiveLineTop(paddingTop + nextLine * lineHeight - textarea.scrollTop)

      if (highlightInnerRef.current) {
        highlightInnerRef.current.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`
      }

      if (gutterInnerRef.current) {
        gutterInnerRef.current.style.transform = `translateY(${-textarea.scrollTop}px)`
      }
    }

    sync()
    textarea.addEventListener('scroll', sync)
    textarea.addEventListener('click', sync)
    textarea.addEventListener('focus', sync)
    textarea.addEventListener('input', sync)
    textarea.addEventListener('keyup', sync)
    textarea.addEventListener('select', sync)

    return () => {
      textarea.removeEventListener('scroll', sync)
      textarea.removeEventListener('click', sync)
      textarea.removeEventListener('focus', sync)
      textarea.removeEventListener('input', sync)
      textarea.removeEventListener('keyup', sync)
      textarea.removeEventListener('select', sync)
    }
  }, [textareaRef, value])

  return (
    <div className="markup-editor">
      <div aria-hidden="true" className="markup-editor__gutter">
        <div className="markup-editor__gutter-inner" ref={gutterInnerRef}>
          {lineNumbers.map((lineNumber) => (
            <span className="markup-editor__line-number" key={lineNumber}>
              {lineNumber}
            </span>
          ))}
        </div>
      </div>

      <div className="markup-editor__code">
        <div aria-hidden="true" className="markup-editor__highlight">
          <div
            className="markup-editor__current-line"
            style={{
              height: activeLineHeight,
              transform: `translateY(${activeLineTop}px)`,
            }}
          />
          <pre
            className="markup-editor__highlight-inner"
            dangerouslySetInnerHTML={{ __html: `${highlightedMarkup || ' '}\n` }}
            ref={highlightInnerRef}
          />
        </div>

        <textarea
          aria-label="Editor de markup do email"
          className="editor-textarea"
          onChange={(event) =>
            onChange(event.target.value, {
              end: event.target.selectionEnd ?? event.target.value.length,
              scrollLeft: event.target.scrollLeft,
              scrollTop: event.target.scrollTop,
              start: event.target.selectionStart ?? event.target.value.length,
            })
          }
          ref={textareaRef}
          spellCheck={false}
          value={value}
        />
      </div>
    </div>
  )
}
