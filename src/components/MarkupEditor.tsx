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

export function MarkupEditor(props: MarkupEditorProps) {
  const { onChange, textareaRef, value } = props
  const gutterInnerRef = useRef<HTMLDivElement | null>(null)
  const mirrorBeforeRef = useRef<HTMLSpanElement | null>(null)
  const mirrorCaretRef = useRef<HTMLSpanElement | null>(null)
  const [activeLineHeight, setActiveLineHeight] = useState(24)
  const [activeLineTop, setActiveLineTop] = useState(14)
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
      const paddingTop = Number.parseFloat(styles.paddingTop) || 14
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24
      const selectionStart = textarea.selectionStart ?? 0

      if (mirrorBeforeRef.current) {
        mirrorBeforeRef.current.textContent = value.slice(0, selectionStart)
      }

      if (mirrorCaretRef.current) {
        mirrorCaretRef.current.textContent = '\u200b'
      }

      const caretTop = mirrorCaretRef.current?.offsetTop ?? paddingTop

      setActiveLineHeight(lineHeight)
      setActiveLineTop(caretTop - textarea.scrollTop)

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
    textarea.addEventListener('mouseup', sync)
    textarea.addEventListener('select', sync)
    textarea.addEventListener('selectionchange', sync)

    return () => {
      textarea.removeEventListener('scroll', sync)
      textarea.removeEventListener('click', sync)
      textarea.removeEventListener('focus', sync)
      textarea.removeEventListener('input', sync)
      textarea.removeEventListener('keyup', sync)
      textarea.removeEventListener('mouseup', sync)
      textarea.removeEventListener('select', sync)
      textarea.removeEventListener('selectionchange', sync)
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
        <div
          aria-hidden="true"
          className="markup-editor__current-line"
          style={{
            height: activeLineHeight,
            transform: `translateY(${activeLineTop}px)`,
          }}
        />

        <div aria-hidden="true" className="markup-editor__measure">
          <span ref={mirrorBeforeRef} />
          <span className="markup-editor__measure-caret" ref={mirrorCaretRef} />
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
          wrap="soft"
          value={value}
        />
      </div>
    </div>
  )
}
