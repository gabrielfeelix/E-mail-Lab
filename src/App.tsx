import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FilePenLine,
  FolderOpen,
  LayoutTemplate,
  Monitor,
  Plus,
  Save,
  Smartphone,
  TabletSmartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { CategoryField } from './components/CategoryField'
import { PreviewFrame } from './components/PreviewFrame'
import { companies, companyThemeStyle, type CompanyId } from './data/companies'
import { sampleMarkup } from './data/presets'
import {
  buildEmailDocument,
  buildEmailDocumentFromParts,
  describeMarkup,
  inlineEmailDocument,
} from './lib/email'
import type { TemplateRecord } from './types/template'

type StoredTemplateCandidate = Partial<TemplateRecord> & {
  css?: string
  html?: string
}

type AppView = 'templates' | 'details' | 'editor' | 'preview'
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

type DeviceConfig = {
  description: string
  height: number
  icon: typeof Monitor
  label: string
  title: string
  width: number
}

type DuplicateState = {
  name: string
  template: TemplateRecord
}

const STORAGE_KEYS = ['email-lab/templates-v2', 'email-lab/templates'] as const
const SELECTED_COMPANY_KEY = 'email-lab/current-company'
const DEFAULT_COMPANY_ID: CompanyId = 'pcyes'
const FALLBACK_COMPANY = companies[0]!
const LOGGED_USER_NAME = 'Gabriel Felix'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const devices = {
  desktop: {
    description: 'Preview desktop para validar a largura principal do email.',
    height: 900,
    icon: Monitor,
    label: 'Desktop',
    title: 'Desktop',
    width: 1280,
  },
  mobile: {
    description: 'Preview mobile para validar quebra, respiro e hierarquia.',
    height: 760,
    icon: Smartphone,
    label: 'Mobile',
    title: 'Mobile',
    width: 390,
  },
  tablet: {
    description: 'Preview intermediario para webviews e tablets.',
    height: 860,
    icon: TabletSmartphone,
    label: 'Tablet',
    title: 'Tablet',
    width: 768,
  },
} satisfies Record<PreviewDevice, DeviceConfig>

const deviceEntries = Object.entries(devices) as Array<[PreviewDevice, DeviceConfig]>

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function createDraft(companyId: CompanyId): TemplateRecord {
  const timestamp = new Date().toISOString()

  return {
    category: '',
    companyId,
    createdAt: timestamp,
    id: crypto.randomUUID(),
    markup: sampleMarkup,
    name: '',
    subject: '',
    updatedAt: timestamp,
  }
}

function normalizeTemplate(record: StoredTemplateCandidate): TemplateRecord {
  const markup =
    typeof record.markup === 'string' && record.markup.trim().length > 0
      ? record.markup
      : typeof record.html === 'string' || typeof record.css === 'string'
        ? buildEmailDocumentFromParts(record.html ?? '', record.css ?? '')
        : sampleMarkup

  const timestamp = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()

  return {
    category: typeof record.category === 'string' ? record.category : 'Institucional',
    companyId:
      typeof record.companyId === 'string' && isCompanyId(record.companyId)
        ? record.companyId
        : DEFAULT_COMPANY_ID,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : timestamp,
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    markup,
    name: typeof record.name === 'string' ? record.name : 'template-sem-nome',
    subject: typeof record.subject === 'string' ? record.subject : 'Sem assunto',
    updatedAt: timestamp,
  }
}

function loadTemplates() {
  if (typeof window === 'undefined') {
    return []
  }

  for (const key of STORAGE_KEYS) {
    const stored = window.localStorage.getItem(key)

    if (!stored) {
      continue
    }

    try {
      const parsed = JSON.parse(stored)

      if (Array.isArray(parsed)) {
        return parsed.map((record) => normalizeTemplate(record as StoredTemplateCandidate))
      }
    } catch {
      return []
    }
  }

  return []
}

function loadSelectedCompany() {
  if (typeof window === 'undefined') {
    return DEFAULT_COMPANY_ID
  }

  const stored = window.localStorage.getItem(SELECTED_COMPANY_KEY)
  return stored && isCompanyId(stored) ? stored : DEFAULT_COMPANY_ID
}

function getUniqueCategories(companyId: CompanyId, templates: TemplateRecord[]) {
  const company = companies.find((item) => item.id === companyId)
  const base = company?.categories ?? []
  const current = templates
    .filter((template) => template.companyId === companyId)
    .map((template) => template.category.trim())
    .filter(Boolean)

  return [...new Set([...base, ...current])]
}

function buildDuplicateName(name: string) {
  return `${name} copy`
}

export function App() {
  const [templates, setTemplates] = useState<TemplateRecord[]>(() => loadTemplates())
  const [companyId, setCompanyId] = useState<CompanyId>(() => loadSelectedCompany())
  const [view, setView] = useState<AppView>('templates')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateRecord | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop')
  const [duplicateState, setDuplicateState] = useState<DuplicateState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null)
  const [inlinedDocument, setInlinedDocument] = useState(() => ({
    document: buildEmailDocument(sampleMarkup),
    markup: sampleMarkup,
  }))

  const currentCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? FALLBACK_COMPANY,
    [companyId],
  )

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [templates],
  )

  const companyTemplates = useMemo(
    () => sortedTemplates.filter((template) => template.companyId === companyId),
    [companyId, sortedTemplates],
  )

  const availableCategories = useMemo(
    () => getUniqueCategories(companyId, templates),
    [companyId, templates],
  )

  const savedTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [activeTemplateId, templates],
  )

  const deferredMarkup = useDeferredValue(draft?.markup ?? sampleMarkup)
  const markupStats = describeMarkup(deferredMarkup)
  const basePreviewDocument = useMemo(() => buildEmailDocument(deferredMarkup), [deferredMarkup])
  const currentPreviewDocument =
    inlinedDocument.markup === deferredMarkup ? inlinedDocument.document : basePreviewDocument

  const isDirty =
    draft !== null &&
    savedTemplate !== null &&
    (draft.name !== savedTemplate.name ||
      draft.category !== savedTemplate.category ||
      draft.subject !== savedTemplate.subject ||
      draft.markup !== savedTemplate.markup)

  const breadcrumbs = useMemo(() => {
    if (view === 'templates') {
      return ['Templates']
    }

    if (view === 'details') {
      return ['Templates', isCreatingNew ? 'New Template' : draft?.name || 'Template Details']
    }

    if (view === 'preview') {
      return ['Templates', draft?.name || 'Template', 'Preview']
    }

    return ['Templates', draft?.name || 'Template', 'Edit Design']
  }, [draft?.name, isCreatingNew, view])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(templates))
    window.localStorage.setItem(SELECTED_COMPANY_KEY, companyId)
  }, [companyId, templates])

  useEffect(() => {
    if ((view !== 'editor' && view !== 'preview') || !draft) {
      return
    }

    let cancelled = false

    inlineEmailDocument(deferredMarkup).then((nextDocument) => {
      if (!cancelled) {
        setInlinedDocument({
          document: nextDocument,
          markup: deferredMarkup,
        })
      }
    })

    return () => {
      cancelled = true
    }
  }, [deferredMarkup, draft, view])

  const handleSelectCompany = (nextCompanyId: CompanyId) => {
    if (nextCompanyId === companyId) {
      return
    }

    startTransition(() => {
      setCompanyId(nextCompanyId)
      setView('templates')
      setDraft(null)
      setIsCreatingNew(false)
      setActiveTemplateId(null)
      setPreviewDevice('desktop')
    })
  }

  const handleOpenList = () => {
    startTransition(() => {
      setView('templates')
      setDraft(null)
      setIsCreatingNew(false)
      setActiveTemplateId(null)
    })
  }

  const handleOpenCreate = () => {
    startTransition(() => {
      setDraft(createDraft(companyId))
      setIsCreatingNew(true)
      setActiveTemplateId(null)
      setView('details')
      setPreviewDevice('desktop')
    })
  }

  const handleOpenDetails = (template: TemplateRecord) => {
    startTransition(() => {
      setDraft({ ...template })
      setIsCreatingNew(false)
      setActiveTemplateId(template.id)
      setView('details')
      setPreviewDevice('desktop')
    })
  }

  const handleOpenPreview = (template: TemplateRecord) => {
    startTransition(() => {
      setDraft({ ...template })
      setIsCreatingNew(false)
      setActiveTemplateId(template.id)
      setView('preview')
      setPreviewDevice('desktop')
    })
  }

  const handleContinueFromDetails = () => {
    if (!draft) {
      return
    }

    const name = draft.name.trim()
    const subject = draft.subject.trim()
    const category = draft.category.trim()

    if (!name || !subject || !category) {
      return
    }

    if (isCreatingNew) {
      const timestamp = new Date().toISOString()
      const nextTemplate: TemplateRecord = {
        ...draft,
        category,
        companyId,
        createdAt: timestamp,
        name,
        subject,
        updatedAt: timestamp,
      }

      startTransition(() => {
        setTemplates((current) => [nextTemplate, ...current])
        setDraft(nextTemplate)
        setIsCreatingNew(false)
        setActiveTemplateId(nextTemplate.id)
        setView('editor')
      })

      return
    }

    setDraft((current) =>
      current
        ? {
            ...current,
            category,
            name,
            subject,
          }
        : current,
    )
    setView('editor')
  }

  const handleSaveDraft = () => {
    if (!draft || !activeTemplateId) {
      return
    }

    const name = draft.name.trim()
    const subject = draft.subject.trim()
    const category = draft.category.trim()

    if (!name || !subject || !category) {
      return
    }

    const nextTemplate: TemplateRecord = {
      ...draft,
      category,
      name,
      subject,
      updatedAt: new Date().toISOString(),
    }

    setTemplates((current) =>
      current.map((template) => (template.id === nextTemplate.id ? nextTemplate : template)),
    )
    setDraft(nextTemplate)
  }

  const handleCancelDetails = () => {
    if (isCreatingNew) {
      handleOpenList()
      return
    }

    if (savedTemplate) {
      setDraft({ ...savedTemplate })
    }

    handleOpenList()
  }

  const handleCancelEditor = () => {
    if (!savedTemplate) {
      handleOpenList()
      return
    }

    setDraft({ ...savedTemplate })
    setView('details')
  }

  const handleDuplicate = () => {
    if (!duplicateState) {
      return
    }

    const nextName = duplicateState.name.trim()

    if (!nextName) {
      return
    }

    const timestamp = new Date().toISOString()
    const duplicatedTemplate: TemplateRecord = {
      ...duplicateState.template,
      createdAt: timestamp,
      id: crypto.randomUUID(),
      name: nextName,
      updatedAt: timestamp,
    }

    startTransition(() => {
      setTemplates((current) => [duplicatedTemplate, ...current])
      setDuplicateState(null)
      setDraft({ ...duplicatedTemplate })
      setActiveTemplateId(duplicatedTemplate.id)
      setIsCreatingNew(false)
      setView('details')
    })
  }

  const handleDeleteTemplate = () => {
    if (!deleteTarget) {
      return
    }

    setTemplates((current) => current.filter((template) => template.id !== deleteTarget.id))

    if (activeTemplateId === deleteTarget.id) {
      setDraft(null)
      setActiveTemplateId(null)
      setIsCreatingNew(false)
      setView('templates')
    }

    setDeleteTarget(null)
  }

  const currentDevice = devices[previewDevice]

  return (
    <main className="shell" style={companyThemeStyle(currentCompany.theme)}>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__eyebrow">E-mail Lab</span>
          <h1>E-mail Lab</h1>
        </div>

        <div className="account-card">
          <span className="account-card__avatar">
            <UserRound size={16} />
          </span>
          <span className="account-card__meta">
            <span className="account-card__label">Account</span>
            <strong>{LOGGED_USER_NAME}</strong>
          </span>
        </div>

        <label className="company-card">
          <span className="company-card__label">Empresa</span>
          <div className="company-card__control">
            <select
              aria-label="Selecionar empresa"
              onChange={(event) => handleSelectCompany(event.target.value as CompanyId)}
              value={companyId}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} />
          </div>
        </label>

        <div className="sidebar__group">
          <span className="sidebar__group-label">Workspace</span>
          <nav className="sidebar__nav" aria-label="Workspace">
            <button
              className={`sidebar__nav-item ${view === 'templates' ? 'is-active' : ''}`.trim()}
              onClick={handleOpenList}
              type="button"
            >
              <LayoutTemplate size={18} />
              <span>Templates</span>
            </button>
          </nav>
        </div>
      </aside>

      <section className="shell__content">
        <header className="topbar">
          <div className="breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span className="breadcrumb__item" key={`${item}-${index}`}>
                {index > 0 && <ChevronRight size={14} />}
                <span>{item}</span>
              </span>
            ))}
          </div>

          <div className="topbar__user">
            <span className="topbar__user-dot" />
            <span>{LOGGED_USER_NAME}</span>
            <ChevronDown size={14} />
          </div>
        </header>

        <div className="shell__body">
          {view === 'templates' && (
            <section className="page">
              <header className="page-heading">
                <div>
                  <h2>Templates</h2>
                  <p>{currentCompany.name}</p>
                </div>

                <button className="primary-button" onClick={handleOpenCreate} type="button">
                  <Plus size={16} />
                  Create New Template
                </button>
              </header>

              {companyTemplates.length === 0 ? (
                <section className="empty-card">
                  <FolderOpen size={30} />
                  <h3>You don't have any email templates yet</h3>
                  <p>
                    Design, edit and organize the HTML email templates for {currentCompany.name} in
                    one place.
                  </p>
                </section>
              ) : (
                <section className="table-card">
                  <table className="template-table" aria-label="Lista de templates">
                    <thead>
                      <tr>
                        <th>Template name</th>
                        <th>Type</th>
                        <th>Category</th>
                        <th>Last update</th>
                        <th aria-label="Acoes" />
                      </tr>
                    </thead>
                    <tbody>
                      {companyTemplates.map((template) => (
                        <tr key={template.id}>
                          <td>
                            <button
                              className="table-link"
                              onClick={() => handleOpenDetails(template)}
                              type="button"
                            >
                              {template.name}
                            </button>
                          </td>
                          <td>HTML</td>
                          <td>{template.category}</td>
                          <td>{dateFormatter.format(new Date(template.updatedAt))}</td>
                          <td>
                            <div className="icon-actions">
                              <button
                                aria-label={`Visualizar ${template.name}`}
                                className="icon-button"
                                onClick={() => handleOpenPreview(template)}
                                title="Preview"
                                type="button"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                aria-label={`Editar ${template.name}`}
                                className="icon-button"
                                onClick={() => handleOpenDetails(template)}
                                title="Editar"
                                type="button"
                              >
                                <FilePenLine size={16} />
                              </button>
                              <button
                                aria-label={`Duplicar ${template.name}`}
                                className="icon-button"
                                onClick={() =>
                                  setDuplicateState({
                                    name: buildDuplicateName(template.name),
                                    template,
                                  })
                                }
                                title="Duplicar"
                                type="button"
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                aria-label={`Excluir ${template.name}`}
                                className="icon-button icon-button--danger"
                                onClick={() => setDeleteTarget(template)}
                                title="Excluir"
                                type="button"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </section>
          )}

          {view === 'details' && draft && (
            <section className="page">
              <div className="details-shell">
                <header className="details-shell__header">
                  <h2>Template Details</h2>
                  <p>Defina as informacoes principais antes de entrar na edicao do template.</p>
                </header>

                <div className="details-fields">
                  <label className="field">
                    <span>Template name *</span>
                    <input
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                name: event.target.value,
                              }
                            : current,
                        )
                      }
                      value={draft.name}
                    />
                  </label>

                  <label className="field">
                    <span>Subject *</span>
                    <input
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                subject: event.target.value,
                              }
                            : current,
                        )
                      }
                      value={draft.subject}
                    />
                  </label>

                  <CategoryField
                    categories={availableCategories}
                    label="Category *"
                    onChange={(value) =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              category: value,
                            }
                          : current,
                      )
                    }
                    value={draft.category}
                  />
                </div>

                <footer className="details-shell__actions">
                  <button className="primary-button" onClick={handleContinueFromDetails} type="button">
                    Continue
                  </button>
                  <button className="secondary-button" onClick={handleCancelDetails} type="button">
                    Cancel
                  </button>
                </footer>
              </div>
            </section>
          )}

          {view === 'preview' && draft && (
            <section className="page page--editor">
              <div className="editor-layout editor-layout--preview">
                <section className="editor-pane editor-pane--summary">
                  <div className="editor-pane__header">
                    <h3>{draft.name}</h3>
                    <p>Preview do template sem abrir o editor.</p>
                  </div>

                  <div className="template-summary">
                    <div>
                      <span>Subject</span>
                      <strong>{draft.subject}</strong>
                    </div>
                    <div>
                      <span>Category</span>
                      <strong>{draft.category}</strong>
                    </div>
                    <div>
                      <span>Company</span>
                      <strong>{currentCompany.name}</strong>
                    </div>
                    <div>
                      <span>Last update</span>
                      <strong>{dateFormatter.format(new Date(draft.updatedAt))}</strong>
                    </div>
                  </div>
                </section>

                <section className="preview-pane">
                  <div className="preview-pane__header">
                    <h3>Preview</h3>
                    <div className="device-switch" role="tablist" aria-label="Dispositivo">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon

                        return (
                          <button
                            aria-label={device.label}
                            aria-selected={previewDevice === deviceId}
                            className={previewDevice === deviceId ? 'is-active' : ''}
                            key={deviceId}
                            onClick={() => setPreviewDevice(deviceId)}
                            role="tab"
                            title={device.label}
                            type="button"
                          >
                            <Icon size={16} />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <PreviewFrame
                    description={currentDevice.description}
                    showHeader={false}
                    srcDoc={currentPreviewDocument}
                    title={currentDevice.title}
                    viewportHeight={currentDevice.height}
                    viewportWidth={currentDevice.width}
                  />
                </section>
              </div>

              <footer className="bottom-bar">
                <button className="secondary-button" onClick={handleOpenList} type="button">
                  Cancel
                </button>
                <button
                  className="primary-button"
                  onClick={() => handleOpenDetails(savedTemplate ?? draft)}
                  type="button"
                >
                  <FilePenLine size={16} />
                  Edit Template
                </button>
              </footer>
            </section>
          )}

          {view === 'editor' && draft && (
            <section className="page page--editor">
              <div className="editor-layout">
                <section className="editor-pane">
                  <div className="editor-pane__header">
                    <div className="editor-pane__tabs">
                      <button className="is-active" type="button">
                        Code Editor
                      </button>
                    </div>
                    <p>
                      Edit the email template in HTML, preview how it looks and validate the final
                      structure before saving.
                    </p>
                  </div>

                  <div className="editor-pane__surface">
                    <div className="editor-pane__surface-head">
                      <span className="editor-pill editor-pill--active">HTML</span>
                      <span className="editor-meta">
                        {markupStats.lines} lines ·{' '}
                        {markupStats.hasStyleTag ? 'style tag presente' : 'sem style tag'}
                      </span>
                    </div>

                    <textarea
                      aria-label="Editor de markup do email"
                      className="editor-textarea"
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                markup: event.target.value,
                              }
                            : current,
                        )
                      }
                      spellCheck={false}
                      value={draft.markup}
                    />
                  </div>
                </section>

                <section className="preview-pane">
                  <div className="preview-pane__header">
                    <h3>Preview</h3>
                    <div className="device-switch" role="tablist" aria-label="Dispositivo">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon

                        return (
                          <button
                            aria-label={device.label}
                            aria-selected={previewDevice === deviceId}
                            className={previewDevice === deviceId ? 'is-active' : ''}
                            key={deviceId}
                            onClick={() => setPreviewDevice(deviceId)}
                            role="tab"
                            title={device.label}
                            type="button"
                          >
                            <Icon size={16} />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <PreviewFrame
                    description={currentDevice.description}
                    showHeader={false}
                    srcDoc={currentPreviewDocument}
                    title={currentDevice.title}
                    viewportHeight={currentDevice.height}
                    viewportWidth={currentDevice.width}
                  />
                </section>
              </div>

              <footer className="bottom-bar">
                <button className="secondary-button" onClick={handleCancelEditor} type="button">
                  Cancel
                </button>
                <button className="primary-button" disabled={!isDirty} onClick={handleSaveDraft} type="button">
                  <Save size={16} />
                  Save
                </button>
                <span className="bottom-bar__status">{isDirty ? 'Unsaved' : 'Saved'}</span>
              </footer>
            </section>
          )}
        </div>
      </section>

      {duplicateState && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <header className="modal-card__header">
              <h3>Duplicate template</h3>
              <button
                aria-label="Fechar"
                className="icon-button"
                onClick={() => setDuplicateState(null)}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>New template name</span>
                <input
                  autoFocus
                  onChange={(event) =>
                    setDuplicateState((current) =>
                      current
                        ? {
                            ...current,
                            name: event.target.value,
                          }
                        : current,
                    )
                  }
                  value={duplicateState.name}
                />
              </label>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setDuplicateState(null)} type="button">
                Cancel
              </button>
              <button className="primary-button" onClick={handleDuplicate} type="button">
                Duplicate
              </button>
            </footer>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <header className="modal-card__header">
              <h3>Delete template</h3>
              <button
                aria-label="Fechar"
                className="icon-button"
                onClick={() => setDeleteTarget(null)}
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <p>
                Delete <strong>{deleteTarget.name}</strong>? This action removes the template from
                the current company list.
              </p>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setDeleteTarget(null)} type="button">
                Cancel
              </button>
              <button className="danger-button" onClick={handleDeleteTemplate} type="button">
                Delete
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}
