import { useEffect, useRef, type RefObject } from 'react'
import { html } from '@codemirror/lang-html'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { indentWithTab } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { defaultHighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export type MarkupEditorHandle = {
  focus: () => void
  replaceSelection: (text: string) => void
}

type MarkupEditorProps = {
  editorRef: RefObject<MarkupEditorHandle | null>
  onChange: (value: string) => void
  value: string
}

const variableDecorator = new MatchDecorator({
  decoration: Decoration.mark({ class: 'cm-template-variable' }),
  regexp: /\{\{[\s\S]*?\}\}/g,
})

const variablePlugin = ViewPlugin.fromClass(
  class {
    decorations

    constructor(view: EditorView) {
      this.decorations = variableDecorator.createDeco(view)
    }

    update(update: Parameters<(typeof variableDecorator)['updateDeco']>[0]) {
      this.decorations = variableDecorator.updateDeco(update, this.decorations)
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
)

const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'transparent',
      color: '#f4f7ff',
      height: '100%',
    },
    '.cm-scroller': {
      fontFamily: "'IBM Plex Mono', Consolas, monospace",
      lineHeight: '1.72',
      overflow: 'auto',
    },
    '.cm-content, .cm-gutterElement': {
      fontFamily: "'IBM Plex Mono', Consolas, monospace",
      fontSize: '0.92rem',
      lineHeight: '1.72',
    },
    '.cm-content': {
      caretColor: '#f4f7ff',
      padding: '14px 16px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'normal',
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-line': {
      padding: 0,
    },
    '.cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(37, 99, 235, 0.55) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#6d83a4',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '44px',
      padding: '0 10px 0 0',
      textAlign: 'right',
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    '.cm-template-variable': {
      color: '#d58cff',
    },
  },
  { dark: true },
)

const editorHighlightStyle = HighlightStyle.define([
  { color: '#6e7f98', tag: tags.comment },
  { color: '#ff6b6b', tag: [tags.angleBracket, tags.tagName] },
  { color: '#31d0aa', tag: [tags.attributeName, tags.labelName] },
  { color: '#ffb454', tag: [tags.attributeValue, tags.string, tags.number, tags.bool] },
  { color: '#7db3ff', tag: [tags.className, tags.typeName] },
  { color: '#7dd3fc', tag: [tags.keyword, tags.propertyName] },
])

const editorExtensions = [
  lineNumbers(),
  highlightActiveLineGutter(),
  drawSelection(),
  highlightActiveLine(),
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({
    autocapitalize: 'off',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
  }),
  html(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  syntaxHighlighting(editorHighlightStyle),
  variablePlugin,
  editorTheme,
]

export function MarkupEditor(props: MarkupEditorProps) {
  const { editorRef, onChange, value } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const host = hostRef.current

    if (!host) {
      return
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...editorExtensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
    })

    viewRef.current = view
    editorRef.current = {
      focus: () => view.focus(),
      replaceSelection: (text: string) => {
        const selection = view.state.selection.main
        const nextCursor = selection.from + text.length

        view.dispatch({
          changes: { from: selection.from, insert: text, to: selection.to },
          selection: { anchor: nextCursor },
          scrollIntoView: true,
        })
        view.focus()
      },
    }

    return () => {
      if (editorRef.current) {
        editorRef.current = null
      }

      view.destroy()
      viewRef.current = null
    }
  }, [editorRef])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    const currentValue = view.state.doc.toString()

    if (currentValue === value) {
      return
    }

    const currentSelection = view.state.selection.main
    const nextCursor = Math.min(currentSelection.head, value.length)

    view.dispatch({
      changes: { from: 0, insert: value, to: currentValue.length },
      selection: { anchor: nextCursor },
    })
  }, [value])

  return <div className="markup-editor markup-editor--codemirror" ref={hostRef} />
}
