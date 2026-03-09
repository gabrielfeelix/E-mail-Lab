import { useEffect, useRef, useState } from 'react'

type PreviewFrameProps = {
  title: string
  description: string
  viewportWidth: number
  viewportHeight: number
  srcDoc: string
  showHeader?: boolean
}

export function PreviewFrame({
  title,
  description,
  viewportWidth,
  viewportHeight,
  srcDoc,
  showHeader = true,
}: PreviewFrameProps) {
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

      const availableWidth = entry.contentRect.width - 24
      setScale(Math.min(1, availableWidth / viewportWidth))
    })

    observer.observe(node)

    return () => observer.disconnect()
  }, [viewportWidth])

  return (
    <section className={`preview-card ${showHeader ? '' : 'preview-card--plain'}`.trim()}>
      {showHeader && (
        <header className="preview-card__header">
          <div>
            <p className="preview-card__eyebrow">{title}</p>
            <h3>{description}</h3>
          </div>
          <div className="preview-card__meta">
            <span>{viewportWidth}px</span>
            <span>{Math.round(scale * 100)}%</span>
          </div>
        </header>
      )}

      <div className="preview-card__viewport" ref={hostRef}>
        <div
          className="preview-card__canvas"
          style={{
            height: viewportHeight * scale,
          }}
        >
          <iframe
            className="preview-card__iframe"
            sandbox=""
            srcDoc={srcDoc}
            style={{
              height: viewportHeight,
              transform: `scale(${scale})`,
              width: viewportWidth,
            }}
            title={title}
          />
        </div>
      </div>
    </section>
  )
}
