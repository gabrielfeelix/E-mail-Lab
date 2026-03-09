import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Clock3,
  MoreVertical,
  Reply,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'

type GmailPreviewProps = {
  mode: 'desktop' | 'mobile' | 'tablet'
  senderAddress: string
  senderName: string
  sentAtLabel: string
  srcDoc: string
  subject: string
  viewportHeight: number
  viewportWidth: number
}

function PreviewCanvas({
  srcDoc,
  viewportHeight,
  viewportWidth,
}: Pick<GmailPreviewProps, 'srcDoc' | 'viewportHeight' | 'viewportWidth'>) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [scale, setScale] = useState(1)
  const [contentWidth, setContentWidth] = useState(() => viewportWidth)
  const [contentHeight, setContentHeight] = useState(() => viewportHeight)

  useEffect(() => {
    const node = hostRef.current

    if (!node) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        return
      }

      const availableWidth = Math.max(entry.contentRect.width - 24, 220)
      setScale(Math.min(1, availableWidth / Math.max(viewportWidth, contentWidth)))
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [contentWidth, viewportWidth])

  useEffect(
    () => () => {
      cleanupRef.current?.()
    },
    [],
  )

  const handleLoad = () => {
    const frame = iframeRef.current
    const doc = frame?.contentDocument

    if (!doc) {
      return
    }

    cleanupRef.current?.()

    const html = doc.documentElement
    const body = doc.body

    const measure = () => {
      const bodyRect = body?.getBoundingClientRect()
      const bodyTop = bodyRect?.top ?? 0
      const bodyLeft = bodyRect?.left ?? 0
      const descendants = Array.from(body?.querySelectorAll('*') ?? [])
      const furthestRight = descendants.reduce((max, element) => {
        const rect = element.getBoundingClientRect()
        return Math.max(max, rect.right - bodyLeft)
      }, Math.ceil(bodyRect?.width ?? 0))
      const furthestBottom = descendants.reduce((max, element) => {
        const rect = element.getBoundingClientRect()
        return Math.max(max, rect.bottom - bodyTop)
      }, Math.ceil(bodyRect?.height ?? 0))
      const nextWidth = Math.max(
        viewportWidth,
        html?.scrollWidth ?? 0,
        body?.scrollWidth ?? 0,
        Math.ceil(bodyRect?.width ?? 0),
        Math.ceil(furthestRight),
      )
      const nextHeight = Math.max(
        viewportHeight,
        html?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0,
        html?.offsetHeight ?? 0,
        body?.offsetHeight ?? 0,
        Math.ceil(bodyRect?.height ?? 0),
        Math.ceil(furthestBottom),
      )

      setContentWidth(nextWidth)
      setContentHeight(nextHeight + 8)
    }

    const resizeObserver = new ResizeObserver(() => {
      measure()
    })
    const mutationObserver = new MutationObserver(() => {
      measure()
    })

    resizeObserver.observe(html)
    resizeObserver.observe(body)
    mutationObserver.observe(body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })

    const imageListeners = Array.from(doc.images).map((image) => {
      const listener = () => measure()
      image.addEventListener('load', listener)
      image.addEventListener('error', listener)
      return () => {
        image.removeEventListener('load', listener)
        image.removeEventListener('error', listener)
      }
    })

    if (doc.fonts?.ready) {
      void doc.fonts.ready.then(() => measure()).catch(() => undefined)
    }

    const timers = [0, 80, 220, 500, 900, 1400, 2200].map((delay) => window.setTimeout(measure, delay))
    measure()

    cleanupRef.current = () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      imageListeners.forEach((dispose) => dispose())
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }

  return (
    <div className="gmail-preview__message" ref={hostRef}>
      <div
        className="gmail-preview__canvas"
        style={{
          height: contentHeight * scale,
          width: contentWidth * scale,
        }}
      >
        <iframe
          className="gmail-preview__iframe"
          onLoad={handleLoad}
          ref={iframeRef}
          sandbox=""
          scrolling="no"
          srcDoc={srcDoc}
          style={{
            height: contentHeight,
            overflow: 'hidden',
            transform: `scale(${scale})`,
            width: contentWidth,
          }}
          title="Gmail preview"
        />
      </div>
    </div>
  )
}

function DesktopShell(props: Omit<GmailPreviewProps, 'mode'>) {
  const { senderAddress, senderName, sentAtLabel, srcDoc, subject, viewportHeight, viewportWidth } = props
  const canvasKey = `${viewportWidth}:${viewportHeight}:${srcDoc.length}:${srcDoc.slice(0, 64)}`

  return (
    <section className="gmail-preview gmail-preview--desktop">
      <header className="gmail-preview__chrome">
        <div className="gmail-preview__brand">
          <span className="gmail-preview__logo">
            <span className="gmail-preview__logo-g">G</span>
          </span>
          <span>Gmail</span>
        </div>
        <div className="gmail-preview__search">Pesquisar e-mail</div>
        <div className="gmail-preview__account">
          <span className="gmail-preview__status" />
          <span>Ativo</span>
        </div>
      </header>

      <div className="gmail-preview__shell">
        <aside className="gmail-preview__sidebar">
          <button className="gmail-preview__compose" type="button">
            Escrever
          </button>
          <div className="gmail-preview__folder gmail-preview__folder--active">Caixa de entrada</div>
          <div className="gmail-preview__folder">Com estrela</div>
          <div className="gmail-preview__folder">Adiados</div>
          <div className="gmail-preview__folder">Compras</div>
        </aside>

        <section className="gmail-preview__mail">
          <div className="gmail-preview__toolbar">
            <ArrowLeft size={16} />
            <Archive size={16} />
            <ShieldAlert size={16} />
            <Trash2 size={16} />
            <Clock3 size={16} />
            <MoreVertical size={16} />
          </div>

          <div className="gmail-preview__subject-row">
            <h4>{subject || 'Sem assunto'}</h4>
            <span className="gmail-preview__chip">Caixa de entrada</span>
          </div>

          <div className="gmail-preview__meta-row">
            <div>
              <strong>{senderName}</strong>
              <span>{senderAddress}</span>
            </div>
            <div className="gmail-preview__meta-actions">
              <span>{sentAtLabel}</span>
              <Star size={16} />
              <Reply size={16} />
              <MoreVertical size={16} />
            </div>
          </div>

          <PreviewCanvas key={canvasKey} srcDoc={srcDoc} viewportHeight={viewportHeight} viewportWidth={viewportWidth} />
        </section>
      </div>
    </section>
  )
}

function MobileShell(props: Omit<GmailPreviewProps, 'mode'> & { compact?: boolean }) {
  const { compact = false, senderAddress, senderName, sentAtLabel, srcDoc, subject, viewportHeight, viewportWidth } = props
  const canvasKey = `${viewportWidth}:${viewportHeight}:${srcDoc.length}:${srcDoc.slice(0, 64)}`

  return (
      <section className={`gmail-preview gmail-preview--mobile ${compact ? 'gmail-preview--tablet' : ''}`.trim()}>
      <div className="gmail-mobile__statusbar">
        <span>13:08</span>
        <span className="gmail-mobile__statusicons">Wi-Fi 68</span>
      </div>

      <div className="gmail-mobile__toolbar">
        <ArrowLeft size={20} />
        <div className="gmail-mobile__toolbar-actions">
          <Sparkles size={18} />
          <Archive size={18} />
          <Trash2 size={18} />
          <ShieldAlert size={18} />
          <MoreVertical size={18} />
        </div>
      </div>

      <div className="gmail-mobile__subject">
        <h4>{subject || 'Sem assunto'}</h4>
        <div className="gmail-mobile__subject-row">
          <span className="gmail-preview__chip gmail-preview__chip--mobile">Caixa de entrada</span>
          <Star size={18} />
        </div>
      </div>

      <section className="gmail-mobile__mail">
        <div className="gmail-mobile__meta">
          <div className="gmail-mobile__avatar">{senderName.slice(0, 1)}</div>
          <div className="gmail-mobile__sender">
            <strong>{senderName}</strong>
            <span>{senderAddress}</span>
          </div>
          <div className="gmail-mobile__meta-side">
            <span>{sentAtLabel}</span>
            <div className="gmail-mobile__meta-icons">
              <Reply size={18} />
              <MoreVertical size={18} />
            </div>
          </div>
        </div>

        <PreviewCanvas key={canvasKey} srcDoc={srcDoc} viewportHeight={viewportHeight} viewportWidth={viewportWidth} />
      </section>
    </section>
  )
}

export function GmailPreview(props: GmailPreviewProps) {
  if (props.mode === 'desktop') {
    return <DesktopShell {...props} />
  }

  return <MobileShell {...props} compact={props.mode === 'tablet'} />
}
