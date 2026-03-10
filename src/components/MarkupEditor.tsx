import { useEffect, useMemo, useRef, type RefObject } from 'react'

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
      if (gutterInnerRef.current) {
        gutterInnerRef.current.style.transform = `translateY(${-textarea.scrollTop}px)`
      }
    }

    sync()
    textarea.addEventListener('scroll', sync)

    return () => {
      textarea.removeEventListener('scroll', sync)
    }
  }, [textareaRef])

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
