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
import { GmailPreview } from './components/GmailPreview'
import { companies, companyThemeStyle, type CompanyId } from './data/companies'
import { sampleMarkup } from './data/presets'
import { describeMarkup, inlineEmailDocument } from './lib/email'
import {
  buildCategoryMap,
  deleteRemoteTemplate,
  importTemplatesToRemote,
  loadRemoteWorkspace,
  saveRemoteTemplate,
} from './lib/template-store'
import type { TemplateRecord } from './types/template'

type AppView = 'templates' | 'details' | 'editor' | 'preview'
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

type DeviceConfig = {
  height: number
  icon: typeof Monitor
  label: string
  width: number
}

type DuplicateState = {
  name: string
  template: TemplateRecord
}

type TemplateFormState = {
  category: string
  name: string
  subject: string
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
    height: 920,
    icon: Monitor,
    label: 'Notebook',
    width: 1280,
  },
  mobile: {
    height: 740,
    icon: Smartphone,
    label: 'Mobile',
    width: 420,
  },
  tablet: {
    height: 860,
    icon: TabletSmartphone,
    label: 'Tablet',
    width: 820,
  },
} satisfies Record<PreviewDevice, DeviceConfig>

const deviceEntries = Object.entries(devices) as Array<[PreviewDevice, DeviceConfig]>

function isCompanyId(value: string): value is CompanyId {
  return companies.some((company) => company.id === value)
}

function createBlankForm(): TemplateFormState {
  return {
    category: '',
    name: '',
    subject: '',
  }
}

function createDraft(template: TemplateFormState, companyId: CompanyId): TemplateRecord {
  const timestamp = new Date().toISOString()

  return {
    category: template.category.trim(),
    companyId,
    createdAt: timestamp,
    id: crypto.randomUUID(),
    markup: sampleMarkup,
    name: template.name.trim(),
    subject: template.subject.trim(),
    updatedAt: timestamp,
  }
}

function normalizeTemplate(record: Partial<TemplateRecord>): TemplateRecord {
  const timestamp = typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()

  return {
    category: typeof record.category === 'string' && record.category.trim() ? record.category : 'Institucional',
    companyId:
      typeof record.companyId === 'string' && isCompanyId(record.companyId)
        ? record.companyId
        : DEFAULT_COMPANY_ID,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : timestamp,
    id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
    markup: typeof record.markup === 'string' && record.markup.trim() ? record.markup : sampleMarkup,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : 'template-sem-nome',
    subject: typeof record.subject === 'string' && record.subject.trim() ? record.subject : 'Sem assunto',
    updatedAt: timestamp,
  }
}

function loadLocalTemplates() {
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
        return parsed.map((record) => normalizeTemplate(record))
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

function buildDuplicateName(name: string) {
  return `${name} copy`
}

export function App() {
  const [initialTemplates] = useState<TemplateRecord[]>(() => loadLocalTemplates())
  const [templates, setTemplates] = useState<TemplateRecord[]>(initialTemplates)
  const [categoryMap, setCategoryMap] = useState<Map<CompanyId, string[]>>(() =>
    buildCategoryMap([], initialTemplates),
  )
  const [companyId, setCompanyId] = useState<CompanyId>(() => loadSelectedCompany())
  const [view, setView] = useState<AppView>('templates')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateRecord | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TemplateFormState>(createBlankForm)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('mobile')
  const [desktopPreviewOpen, setDesktopPreviewOpen] = useState(false)
  const [duplicateState, setDuplicateState] = useState<DuplicateState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [inlinedDocument, setInlinedDocument] = useState(sampleMarkup)

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

  const savedTemplate = useMemo(
    () => templates.find((template) => template.id === activeTemplateId) ?? null,
    [activeTemplateId, templates],
  )

  const availableCategories = useMemo(() => {
    const base = categoryMap.get(companyId) ?? currentCompany.categories
    const fromTemplates = companyTemplates.map((template) => template.category)
    return [...new Set([...base, ...fromTemplates])].sort((left, right) => left.localeCompare(right))
  }, [categoryMap, companyId, companyTemplates, currentCompany.categories])

  const deferredMarkup = useDeferredValue(draft?.markup ?? sampleMarkup)
  const markupStats = useMemo(() => describeMarkup(deferredMarkup), [deferredMarkup])

  const isDirty = useMemo(() => {
    if (!draft || !savedTemplate) {
      return false
    }

    return (
      draft.name !== savedTemplate.name ||
      draft.category !== savedTemplate.category ||
      draft.subject !== savedTemplate.subject ||
      draft.markup !== savedTemplate.markup
    )
  }, [draft, savedTemplate])

  const breadcrumbs = useMemo(() => {
    if (view === 'templates') {
      return ['Templates']
    }

    if (view === 'preview') {
      return ['Templates', draft?.name || 'Template', 'Preview']
    }

    if (view === 'details') {
      return ['Templates', draft?.name || 'Template', 'Details']
    }

    return ['Templates', draft?.name || 'Template', 'Edit Design']
  }, [draft?.name, view])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(templates))
    window.localStorage.setItem(SELECTED_COMPANY_KEY, companyId)
  }, [companyId, templates])

  useEffect(() => {
    let cancelled = false

    async function hydrateWorkspace() {
      try {
        const remote = await loadRemoteWorkspace()
        let nextTemplates = remote.templates

        if (remote.templates.length === 0 && initialTemplates.length > 0) {
          nextTemplates = await importTemplatesToRemote(initialTemplates)
          if (!cancelled) {
            setNotice('Templates locais importados para o Supabase.')
          }
        }

        if (cancelled) {
          return
        }

        setTemplates(nextTemplates)
        setCategoryMap(buildCategoryMap(remote.categories, nextTemplates))
      } catch {
        if (!cancelled) {
          setNotice('Supabase indisponivel. Mantendo os dados locais nesta sessao.')
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false)
        }
      }
    }

    hydrateWorkspace()

    return () => {
      cancelled = true
    }
  }, [initialTemplates])

  useEffect(() => {
    if ((view !== 'editor' && view !== 'preview') || !draft) {
      return
    }

    let cancelled = false

    inlineEmailDocument(deferredMarkup)
      .then((nextDocument) => {
        if (!cancelled) {
          setInlinedDocument(nextDocument)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInlinedDocument(draft.markup)
        }
      })

    return () => {
      cancelled = true
    }
  }, [deferredMarkup, draft, view])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timeout = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const syncTemplateInState = (template: TemplateRecord) => {
    setTemplates((current) => {
      const exists = current.some((item) => item.id === template.id)
      return exists
        ? current.map((item) => (item.id === template.id ? template : item))
        : [template, ...current]
    })

    setCategoryMap((current) => {
      const next = new Map(current)
      const categories = next.get(template.companyId) ?? []

      if (!categories.includes(template.category)) {
        next.set(template.companyId, [...categories, template.category].sort((a, b) => a.localeCompare(b)))
      }

      return next
    })
  }

  const persistTemplate = async (template: TemplateRecord) => {
    setIsSaving(true)

    try {
      const saved = await saveRemoteTemplate(template)
      syncTemplateInState(saved)
      setDraft(saved)
      setActiveTemplateId(saved.id)
      return saved
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelectCompany = (nextCompanyId: CompanyId) => {
    if (nextCompanyId === companyId) {
      return
    }

    startTransition(() => {
      setCompanyId(nextCompanyId)
      setView('templates')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewDevice('mobile')
      setDesktopPreviewOpen(false)
    })
  }

  const handleOpenList = () => {
    startTransition(() => {
      setView('templates')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewDevice('mobile')
      setDesktopPreviewOpen(false)
    })
  }

  const handleOpenCreate = () => {
    setCreateForm(createBlankForm())
    setCreateModalOpen(true)
  }

  const handleCreateTemplate = async () => {
    const nextDraft = createDraft(createForm, companyId)

    if (!nextDraft.name || !nextDraft.subject || !nextDraft.category) {
      return
    }

    try {
      const saved = await persistTemplate(nextDraft)
      startTransition(() => {
        setCreateModalOpen(false)
        setCreateForm(createBlankForm())
        setDraft(saved)
        setView('editor')
      })
    } catch {
      setNotice('Nao foi possivel criar o template no Supabase.')
    }
  }

  const handleOpenDetails = (template: TemplateRecord) => {
    startTransition(() => {
      setDraft({ ...template })
      setActiveTemplateId(template.id)
      setView('details')
    })
  }

  const handleOpenPreview = (template: TemplateRecord) => {
    startTransition(() => {
      setDraft({ ...template })
      setActiveTemplateId(template.id)
      setView('preview')
      setPreviewDevice('mobile')
      setDesktopPreviewOpen(false)
    })
  }

  const handleContinueFromDetails = () => {
    if (!draft || !draft.name.trim() || !draft.subject.trim() || !draft.category.trim()) {
      return
    }

    setDraft((current) =>
      current
        ? {
            ...current,
            category: current.category.trim(),
            name: current.name.trim(),
            subject: current.subject.trim(),
          }
        : current,
    )

    setView('editor')
  }

  const handleSaveDraft = async () => {
    if (!draft) {
      return
    }

    const nextDraft: TemplateRecord = {
      ...draft,
      category: draft.category.trim(),
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      updatedAt: new Date().toISOString(),
    }

    if (!nextDraft.name || !nextDraft.subject || !nextDraft.category) {
      return
    }

    try {
      await persistTemplate(nextDraft)
      setNotice('Template salvo no Supabase.')
    } catch {
      setNotice('Nao foi possivel salvar o template no Supabase.')
    }
  }

  const handleDuplicate = async () => {
    if (!duplicateState) {
      return
    }

    const nextName = duplicateState.name.trim()

    if (!nextName) {
      return
    }

    const duplicatedTemplate: TemplateRecord = {
      ...duplicateState.template,
      createdAt: new Date().toISOString(),
      id: crypto.randomUUID(),
      name: nextName,
      updatedAt: new Date().toISOString(),
    }

    try {
      const saved = await persistTemplate(duplicatedTemplate)
      setDuplicateState(null)
      setDraft(saved)
      setView('details')
      setNotice('Template duplicado.')
    } catch {
      setNotice('Nao foi possivel duplicar o template.')
    }
  }

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) {
      return
    }

    try {
      await deleteRemoteTemplate(deleteTarget.id)
      setTemplates((current) => current.filter((template) => template.id !== deleteTarget.id))

      if (activeTemplateId === deleteTarget.id) {
        setDraft(null)
        setActiveTemplateId(null)
        setView('templates')
      }

      setDeleteTarget(null)
      setNotice('Template excluido.')
    } catch {
      setNotice('Nao foi possivel excluir o template.')
    }
  }

  const handleCopyMarkup = async () => {
    if (!draft) {
      return
    }

    await navigator.clipboard.writeText(draft.markup)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const currentDevice = devices[previewDevice]
  const senderAddress = `no-reply@${currentCompany.id}.com`
  const sentAtLabel = draft ? dateFormatter.format(new Date(draft.updatedAt)) : dateFormatter.format(new Date())
  const handlePreviewDeviceChange = (deviceId: PreviewDevice) => {
    if (deviceId === 'desktop') {
      setDesktopPreviewOpen(true)
      return
    }

    setDesktopPreviewOpen(false)
    setPreviewDevice(deviceId)
  }

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
          <nav aria-label="Workspace" className="sidebar__nav">
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
          {notice && <div className="notice-banner">{notice}</div>}

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

              {isHydrating ? (
                <section className="empty-card">
                  <h3>Carregando templates</h3>
                  <p>Sincronizando os dados do Supabase para esta empresa.</p>
                </section>
              ) : companyTemplates.length === 0 ? (
                <section className="empty-card">
                  <FolderOpen size={30} />
                  <h3>You do not have any email templates yet</h3>
                  <p>Crie o primeiro template de {currentCompany.name} para comecar a trabalhar no editor.</p>
                </section>
              ) : (
                <section className="table-card">
                  <table aria-label="Lista de templates" className="template-table">
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
                            <button className="table-link" onClick={() => handleOpenDetails(template)} type="button">
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
            <section className="details-page">
              <div className="details-page__panel">
                <header className="details-page__header">
                  <div>
                    <span className="details-page__eyebrow">Template Details</span>
                    <h2>Template Details</h2>
                    <p>Defina as informacoes principais antes de entrar na edicao do template.</p>
                  </div>
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

                <div className="details-page__meta">
                  <div>
                    <span>Empresa</span>
                    <strong>{currentCompany.name}</strong>
                  </div>
                  <div>
                    <span>Atualizado</span>
                    <strong>{dateFormatter.format(new Date(draft.updatedAt))}</strong>
                  </div>
                  <div>
                    <span>Formato</span>
                    <strong>HTML</strong>
                  </div>
                </div>

                <div className="details-page__actions">
                  <button className="primary-button" onClick={handleContinueFromDetails} type="button">
                    Continue
                  </button>
                  <button className="secondary-button" onClick={handleOpenList} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          )}

          {view === 'preview' && draft && (
            <section className="page">
              <section className="preview-shell">
                <header className="preview-shell__header">
                  <div>
                    <span className="details-page__eyebrow">Preview</span>
                    <h2>{draft.name}</h2>
                    <p>Leitura contextualizada antes de abrir o editor.</p>
                  </div>

                  <div className="preview-shell__actions">
                    <div aria-label="Dispositivo" className="device-switch" role="tablist">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon
                        return (
                          <button
                            aria-label={device.label}
                            aria-selected={deviceId === 'desktop' ? desktopPreviewOpen : previewDevice === deviceId}
                            className={
                              (deviceId === 'desktop' ? desktopPreviewOpen : previewDevice === deviceId)
                                ? 'is-active'
                                : ''
                            }
                            key={deviceId}
                            onClick={() => handlePreviewDeviceChange(deviceId)}
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
                </header>

                <div style={{ padding: '24px' }}>
                  <GmailPreview
                    mode={previewDevice}
                    senderAddress={senderAddress}
                    senderName={currentCompany.name}
                    sentAtLabel={sentAtLabel}
                    srcDoc={inlinedDocument}
                    subject={draft.subject}
                    viewportHeight={currentDevice.height}
                    viewportWidth={currentDevice.width}
                  />
                </div>

                <footer className="bottom-bar">
                  <button className="secondary-button" onClick={handleOpenList} type="button">
                    Cancel
                  </button>
                  <button className="primary-button" onClick={() => setView('editor')} type="button">
                    <FilePenLine size={16} />
                    Edit Template
                  </button>
                </footer>
              </section>
            </section>
          )}

          {view === 'editor' && draft && (
            <section className="page page--editor">
              <div className="editor-workbench">
                <section className="editor-column">
                  <div className="editor-column__top">
                    <div className="editor-column__tabs">
                      <button className="is-active" type="button">
                        Code Editor
                      </button>
                    </div>
                    <p className="editor-column__intro">HTML completo a esquerda. Preview Gmail a direita.</p>
                  </div>

                  <div className="editor-column__surface">
                    <div className="editor-column__surface-top">
                      <span className="editor-badge">HTML</span>
                      <span className="editor-stats">
                        {markupStats.lines} lines | {markupStats.hasMediaQuery ? 'media queries' : 'sem media queries'}
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

                <section className="preview-column">
                  <div className="preview-column__top">
                    <div>
                      <h3>Preview</h3>
                      <p>Shell visual separada do markup. O copy continua trazendo apenas o HTML do template.</p>
                    </div>

                    <div aria-label="Dispositivo" className="device-switch" role="tablist">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon
                        return (
                          <button
                            aria-label={device.label}
                            aria-selected={deviceId === 'desktop' ? desktopPreviewOpen : previewDevice === deviceId}
                            className={
                              (deviceId === 'desktop' ? desktopPreviewOpen : previewDevice === deviceId)
                                ? 'is-active'
                                : ''
                            }
                            key={deviceId}
                            onClick={() => handlePreviewDeviceChange(deviceId)}
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

                  <GmailPreview
                    mode={previewDevice}
                    senderAddress={senderAddress}
                    senderName={currentCompany.name}
                    sentAtLabel={sentAtLabel}
                    srcDoc={inlinedDocument}
                    subject={draft.subject}
                    viewportHeight={currentDevice.height}
                    viewportWidth={currentDevice.width}
                  />
                </section>
              </div>

              <footer className="bottom-bar">
                <button className="secondary-button" onClick={() => setView('details')} type="button">
                  Cancel
                </button>
                <button className="secondary-button" onClick={handleCopyMarkup} type="button">
                  <Copy size={16} />
                  {copied ? 'Copiado' : 'Copiar markup'}
                </button>
                <button className="primary-button" disabled={!isDirty || isSaving} onClick={handleSaveDraft} type="button">
                  <Save size={16} />
                  {isSaving ? 'Salvando' : 'Save'}
                </button>
                <span className="bottom-bar__status">{isDirty ? 'Unsaved' : 'Saved'}</span>
              </footer>
            </section>
          )}
        </div>
      </section>

      {createModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--wide" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Template Details</h3>
                <p>Preencha os dados principais e continue para o editor.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setCreateModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>Template name *</span>
                <input
                  autoFocus
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={createForm.name}
                />
              </label>

              <label className="field">
                <span>Subject *</span>
                <input
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  value={createForm.subject}
                />
              </label>

              <CategoryField
                categories={availableCategories}
                label="Category *"
                onChange={(value) =>
                  setCreateForm((current) => ({
                    ...current,
                    category: value,
                  }))
                }
                value={createForm.category}
              />
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setCreateModalOpen(false)} type="button">
                Cancel
              </button>
              <button
                className="primary-button"
                disabled={!createForm.name.trim() || !createForm.subject.trim() || !createForm.category.trim() || isSaving}
                onClick={handleCreateTemplate}
                type="button"
              >
                Continue
              </button>
            </footer>
          </section>
        </div>
      )}

      {desktopPreviewOpen && draft && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--preview" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Preview Notebook</h3>
                <p>Shell completa do Gmail para validar a leitura em tela ampla.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setDesktopPreviewOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__preview">
              <GmailPreview
                mode="desktop"
                senderAddress={senderAddress}
                senderName={currentCompany.name}
                sentAtLabel={sentAtLabel}
                srcDoc={inlinedDocument}
                subject={draft.subject}
                viewportHeight={devices.desktop.height}
                viewportWidth={devices.desktop.width}
              />
            </div>
          </section>
        </div>
      )}

      {duplicateState && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <header className="modal-card__header">
              <h3>Duplicate template</h3>
              <button aria-label="Fechar" className="icon-button" onClick={() => setDuplicateState(null)} type="button">
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
              <button
                className="primary-button"
                disabled={isSaving || !duplicateState.name.trim()}
                onClick={handleDuplicate}
                type="button"
              >
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
              <button aria-label="Fechar" className="icon-button" onClick={() => setDeleteTarget(null)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <p>
                Delete <strong>{deleteTarget.name}</strong>? Esta acao remove o template da lista atual.
              </p>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setDeleteTarget(null)} type="button">
                Cancel
              </button>
              <button className="danger-button" disabled={isSaving} onClick={handleDeleteTemplate} type="button">
                Delete
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}
