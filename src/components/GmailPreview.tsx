import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Clock3,
  MoreVertical,
  Reply,
  ShieldAlert,
  Star,
  Trash2,
} from 'lucide-react'

type GmailPreviewProps = {
  senderAddress: string
  senderName: string
  sentAtLabel: string
  srcDoc: string
  subject: string
  viewportHeight: number
  viewportWidth: number
}

export function GmailPreview({
  senderAddress,
  senderName,
  sentAtLabel,
  srcDoc,
  subject,
  viewportHeight,
  viewportWidth,
}: GmailPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

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

      const availableWidth = entry.contentRect.width - 48
      setScale(Math.min(1, availableWidth / viewportWidth))
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [viewportWidth])

  return (
    <section className="gmail-preview">
      <header className="gmail-preview__chrome">
        <div className="gmail-preview__brand">
          <span className="gmail-preview__logo">M</span>
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
          <div className="gmail-preview__folder gmail-preview__folder--active">
            Caixa de entrada
          </div>
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

          <div className="gmail-preview__message" ref={hostRef}>
            <div
              className="gmail-preview__canvas"
              style={{
                height: viewportHeight * scale,
              }}
            >
              <iframe
                className="gmail-preview__iframe"
                sandbox=""
                srcDoc={srcDoc}
                style={{
                  height: viewportHeight,
                  transform: `scale(${scale})`,
                  width: viewportWidth,
                }}
                title="Gmail preview"
              />
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
