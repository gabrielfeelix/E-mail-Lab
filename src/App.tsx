import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
import {
  ArrowLeft,
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
import { hasSupabaseConfig } from './lib/supabase'
import type { TemplateRecord } from './types/template'

type StoredTemplateCandidate = Partial<TemplateRecord> & {
  css?: string
  html?: string
}

type AppView = 'templates' | 'create' | 'details' | 'editor'
type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

type DeviceConfig = {
  description: string
  height: number
  icon: typeof Monitor
  label: string
  title: string
  width: number
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
    description: 'Preview amplo no mesmo padrao de alternancia por dispositivo usado no Mailtrap.',
    height: 920,
    icon: Monitor,
    label: 'Desktop',
    title: 'Desktop',
    width: 1280,
  },
  mobile: {
    description: 'Viewport compacto para validar leitura em tela pequena.',
    height: 760,
    icon: Smartphone,
    label: 'Mobile',
    title: 'Mobile',
    width: 390,
  },
  tablet: {
    description: 'Faixa intermediaria para webviews e tablets.',
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

function createBlankForm() {
  return {
    category: '',
    name: '',
    subject: '',
  }
}

export function App() {
  const [templates, setTemplates] = useState<TemplateRecord[]>(() => loadTemplates())
  const [companyId, setCompanyId] = useState<CompanyId>(() => loadSelectedCompany())
  const [view, setView] = useState<AppView>('templates')
  const [createForm, setCreateForm] = useState(createBlankForm)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateRecord | null>(null)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop')
  const [copied, setCopied] = useState(false)
  const [inlinedDocument, setInlinedDocument] = useState(() => buildEmailDocument(sampleMarkup))

  const currentCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? FALLBACK_COMPANY,
    [companyId],
  )
  const supabaseReady = hasSupabaseConfig()

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
  const fallbackDocument = useMemo(() => buildEmailDocument(deferredMarkup), [deferredMarkup])

  const isDirty =
    draft !== null &&
    (savedTemplate === null ||
      draft.name !== savedTemplate.name ||
      draft.category !== savedTemplate.category ||
      draft.subject !== savedTemplate.subject ||
      draft.markup !== savedTemplate.markup)

  const loggedUserInitials = useMemo(
    () =>
      LOGGED_USER_NAME.split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((chunk) => chunk[0]?.toUpperCase() ?? '')
        .join(''),
    [],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(templates))
    window.localStorage.setItem(SELECTED_COMPANY_KEY, companyId)
  }, [companyId, templates])

  useEffect(() => {
    if ((view !== 'details' && view !== 'editor') || !draft) {
      return
    }

    let cancelled = false

    inlineEmailDocument(deferredMarkup).then((nextDocument) => {
      if (!cancelled) {
        setInlinedDocument(nextDocument)
      }
    })

    return () => {
      cancelled = true
    }
  }, [deferredMarkup, draft, view])

  const handleOpenCreate = () => {
    startTransition(() => {
      setCreateForm(createBlankForm())
      setView('create')
      setActiveTemplateId(null)
      setDraft(null)
      setCopied(false)
    })
  }

  const handleOpenDetails = (template: TemplateRecord) => {
    startTransition(() => {
      setActiveTemplateId(template.id)
      setDraft({ ...template })
      setView('details')
      setCopied(false)
    })
  }

  const handleSaveDraft = () => {
    if (!draft) {
      return
    }

    const now = new Date().toISOString()
    const nextTemplate = {
      ...draft,
      updatedAt: now,
    }

    setTemplates((current) =>
      current.map((template) => (template.id === nextTemplate.id ? nextTemplate : template)),
    )
    setDraft(nextTemplate)
  }

  const handleCreateTemplate = () => {
    const category = createForm.category.trim()
    const name = createForm.name.trim()
    const subject = createForm.subject.trim()

    if (!category || !name || !subject) {
      return
    }

    const now = new Date().toISOString()
    const template: TemplateRecord = {
      category,
      companyId,
      createdAt: now,
      id: crypto.randomUUID(),
      markup: sampleMarkup,
      name,
      subject,
      updatedAt: now,
    }

    startTransition(() => {
      setTemplates((current) => [template, ...current])
      setActiveTemplateId(template.id)
      setDraft(template)
      setPreviewDevice('desktop')
      setView('editor')
    })
  }

  const handleCopyMarkup = async () => {
    await navigator.clipboard.writeText(inlinedDocument)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const handleSelectCompany = (nextCompanyId: CompanyId) => {
    if (nextCompanyId === companyId) {
      return
    }

    startTransition(() => {
      setCompanyId(nextCompanyId)
      setCreateForm(createBlankForm())
      setCopied(false)

      if (!draft || draft.companyId !== nextCompanyId) {
        setDraft(null)
        setActiveTemplateId(null)
        setView('templates')
      }
    })
  }

  const previewDocument = view === 'details' || view === 'editor' ? inlinedDocument : fallbackDocument
  const currentDevice = devices[previewDevice]

  return (
    <main className="layout" style={companyThemeStyle(currentCompany.theme)}>
      <aside className="shell-sidebar">
        <div className="shell-sidebar__brand">
          <span className="shell-sidebar__eyebrow">E-mail Lab</span>
          <h1>E-mail Lab</h1>
          <p>Templates separados por empresa, com preview tecnico e identidade visual por projeto.</p>
        </div>

        <section className="user-panel">
          <div className="user-panel__avatar">{loggedUserInitials}</div>
          <div className="user-panel__content">
            <span className="shell-sidebar__label">Usuario logado</span>
            <strong>{LOGGED_USER_NAME}</strong>
            <span className={`connection-badge ${supabaseReady ? 'connection-badge--ready' : ''}`}>
              {supabaseReady ? 'Supabase pronto' : 'Modo local'}
            </span>
            <label className="company-switch">
              <span>Empresa selecionada</span>
              <select
                onChange={(event) => handleSelectCompany(event.target.value as CompanyId)}
                value={companyId}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <button className="primary-action" onClick={handleOpenCreate} type="button">
          <Plus size={18} />
          Novo template
        </button>

        <nav className="shell-nav" aria-label="Navegacao">
          <button className="shell-nav__item shell-nav__item--active" type="button">
            <LayoutTemplate size={18} />
            <span>Templates</span>
            <strong>{companyTemplates.length}</strong>
          </button>
        </nav>
      </aside>

      <section className="shell-content">
        {view === 'templates' && (
          <section className="page">
            <header className="page-header">
              <div>
                <p className="page-header__eyebrow">{currentCompany.name}</p>
                <h2>Templates da empresa</h2>
                <p>Cada empresa mantem seus proprios templates e sua propria identidade visual.</p>
              </div>
            </header>

            {companyTemplates.length === 0 ? (
              <section className="empty-state">
                <FolderOpen size={28} />
                <h3>Nenhum template cadastrado</h3>
                <p>
                  Crie o primeiro template de {currentCompany.name} para comecar a organizar os
                  envios dessa empresa.
                </p>
                <button
                  className="primary-action primary-action--inline"
                  onClick={handleOpenCreate}
                  type="button"
                >
                  <Plus size={18} />
                  Novo template
                </button>
              </section>
            ) : (
              <section className="table-card">
                <div className="table-card__header">
                  <h3>Lista de templates</h3>
                  <span>{companyTemplates.length} itens</span>
                </div>

                <div className="template-table-wrap">
                  <table className="template-table" aria-label="Lista de templates">
                    <colgroup>
                      <col className="template-table__col template-table__col--name" />
                      <col className="template-table__col template-table__col--category" />
                      <col className="template-table__col template-table__col--subject" />
                      <col className="template-table__col template-table__col--updated" />
                      <col className="template-table__col template-table__col--actions" />
                    </colgroup>
                    <thead>
                      <tr className="template-table__head">
                        <th scope="col">Nome</th>
                        <th scope="col">Categoria</th>
                        <th scope="col">Assunto</th>
                        <th scope="col">Atualizado</th>
                        <th scope="col">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companyTemplates.map((template) => (
                        <tr className="template-row" key={template.id}>
                          <td className="template-row__name">
                            <strong>{template.name}</strong>
                          </td>
                          <td>
                            <span className="tag-chip">{template.category}</span>
                          </td>
                          <td className="template-row__subject">{template.subject}</td>
                          <td>{dateFormatter.format(new Date(template.updatedAt))}</td>
                          <td className="row-actions">
                            <button
                              className="secondary-button"
                              onClick={() => handleOpenDetails(template)}
                              type="button"
                            >
                              <Eye size={16} />
                              Preview
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => handleOpenDetails(template)}
                              type="button"
                            >
                              <FilePenLine size={16} />
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </section>
        )}

        {view === 'create' && (
          <section className="page">
            <header className="page-header page-header--split">
              <div>
                <p className="page-header__eyebrow">{currentCompany.name}</p>
                <h2>Novo template</h2>
                <p>Escolha uma categoria existente ou crie uma nova. Depois seguimos para o editor.</p>
              </div>

              <button className="secondary-button" onClick={() => setView('templates')} type="button">
                <ArrowLeft size={16} />
                Voltar
              </button>
            </header>

            <section className="form-card">
              <div className="form-grid">
                <CategoryField
                  categories={availableCategories}
                  onChange={(value) =>
                    setCreateForm((current) => ({
                      ...current,
                      category: value,
                    }))
                  }
                  value={createForm.category}
                />

                <label className="field">
                  <span>Nome do template</span>
                  <input
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Ex.: onboarding-boas-vindas"
                    value={createForm.name}
                  />
                </label>

                <label className="field field--full">
                  <span>Assunto</span>
                  <input
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    placeholder="Ex.: Bem-vindo ao portal da empresa"
                    value={createForm.subject}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="secondary-button" onClick={() => setView('templates')} type="button">
                  Cancelar
                </button>
                <button
                  className="primary-action primary-action--inline"
                  disabled={
                    !createForm.category.trim() ||
                    !createForm.name.trim() ||
                    !createForm.subject.trim()
                  }
                  onClick={handleCreateTemplate}
                  type="button"
                >
                  <Plus size={18} />
                  Criar e editar
                </button>
              </div>
            </section>
          </section>
        )}

        {view === 'details' && draft && (
          <section className="page">
            <header className="page-header page-header--split">
              <div>
                <p className="page-header__eyebrow">{currentCompany.name}</p>
                <h2>{draft.name}</h2>
                <p>Informacoes gerais do template, com preview tecnico e acesso ao editor.</p>
              </div>

              <div className="header-actions">
                <button className="secondary-button" onClick={() => setView('templates')} type="button">
                  <ArrowLeft size={16} />
                  Voltar para templates
                </button>
                <button className="secondary-button" onClick={handleSaveDraft} type="button">
                  <Save size={16} />
                  Salvar informacoes
                </button>
                <button
                  className="primary-action primary-action--inline"
                  onClick={() => setView('editor')}
                  type="button"
                >
                  <FilePenLine size={18} />
                  Editar codigo
                </button>
              </div>
            </header>

            <section className="details-grid">
              <article className="info-card">
                <div className="info-card__header">
                  <h3>Informacoes gerais</h3>
                  <p>Dados basicos do template antes de entrar no codigo.</p>
                </div>

                <div className="form-grid">
                  <CategoryField
                    categories={availableCategories}
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

                  <label className="field">
                    <span>Nome do template</span>
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

                  <label className="field field--full">
                    <span>Assunto</span>
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
                </div>

                <div className="meta-grid">
                  <div>
                    <span>Empresa</span>
                    <strong>{currentCompany.name}</strong>
                  </div>
                  <div>
                    <span>Criado em</span>
                    <strong>{dateFormatter.format(new Date(draft.createdAt))}</strong>
                  </div>
                  <div>
                    <span>Ultima atualizacao</span>
                    <strong>{dateFormatter.format(new Date(draft.updatedAt))}</strong>
                  </div>
                  <div>
                    <span>Markup</span>
                    <strong>{markupStats.lines} linhas</strong>
                  </div>
                </div>
              </article>

              <article className="preview-shell">
                <header className="preview-shell__header">
                  <div>
                    <h3>Preview</h3>
                    <p>Alternancia por dispositivo inspirada no fluxo do Mailtrap Templates.</p>
                  </div>

                  <div className="preview-shell__actions">
                    <div className="tab-switch" role="tablist" aria-label="Dispositivo">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon

                        return (
                          <button
                            aria-selected={previewDevice === deviceId}
                            className={previewDevice === deviceId ? 'is-active' : ''}
                            key={deviceId}
                            onClick={() => setPreviewDevice(deviceId)}
                            role="tab"
                            type="button"
                          >
                            <Icon size={16} />
                            {device.label}
                          </button>
                        )
                      })}
                    </div>

                    <button className="secondary-button" onClick={handleCopyMarkup} type="button">
                      <Copy size={16} />
                      {copied ? 'Copiado' : 'Copiar markup'}
                    </button>
                  </div>
                </header>

                <PreviewFrame
                  description={currentDevice.description}
                  srcDoc={previewDocument}
                  title={currentDevice.title}
                  viewportHeight={currentDevice.height}
                  viewportWidth={currentDevice.width}
                />
              </article>
            </section>
          </section>
        )}

        {view === 'editor' && draft && (
          <section className="page page--editor">
            <header className="page-header page-header--split">
              <div>
                <p className="page-header__eyebrow">{currentCompany.name}</p>
                <h2>Editor de template</h2>
                <p>Um unico editor de markup, com HTML e CSS no mesmo documento, como no Mailtrap.</p>
              </div>

              <div className="header-actions">
                <button className="secondary-button" onClick={() => setView('details')} type="button">
                  <ArrowLeft size={16} />
                  Informacoes gerais
                </button>
                <button className="secondary-button" onClick={handleCopyMarkup} type="button">
                  <Copy size={16} />
                  {copied ? 'Copiado' : 'Copiar markup'}
                </button>
                <button
                  className="primary-action primary-action--inline"
                  disabled={!isDirty}
                  onClick={handleSaveDraft}
                  type="button"
                >
                  <Save size={18} />
                  {isDirty ? 'Salvar template' : 'Salvo'}
                </button>
              </div>
            </header>

            <section className="editor-summary">
              <span className="tag-chip">{currentCompany.name}</span>
              <span className="tag-chip">{draft.category}</span>
              <span className="summary-subject">{draft.subject}</span>
            </section>

            <section className="workspace-grid">
              <article className="editor-card">
                <header className="editor-card__header">
                  <div>
                    <h3>Markup do e-mail</h3>
                    <p>
                      Cole tudo no mesmo lugar: estrutura HTML, <code>{'<style>'}</code> e ajustes do
                      template.
                    </p>
                  </div>
                </header>

                <textarea
                  aria-label="Editor de markup do e-mail"
                  className="editor-card__textarea"
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

                <footer className="editor-card__footer">
                  <span>{markupStats.lines} linhas</span>
                  <span>{markupStats.hasStyleTag ? 'Com style tag' : 'Sem style tag'}</span>
                  <span>{markupStats.hasMediaQuery ? 'Com media queries' : 'Sem media queries'}</span>
                </footer>
              </article>

              <article className="preview-shell">
                <header className="preview-shell__header">
                  <div>
                    <h3>Preview</h3>
                    <p>Atualizacao em tempo real conforme o codigo e alterado.</p>
                  </div>

                  <div className="preview-shell__actions">
                    <div className="tab-switch" role="tablist" aria-label="Dispositivo">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon

                        return (
                          <button
                            aria-selected={previewDevice === deviceId}
                            className={previewDevice === deviceId ? 'is-active' : ''}
                            key={deviceId}
                            onClick={() => setPreviewDevice(deviceId)}
                            role="tab"
                            type="button"
                          >
                            <Icon size={16} />
                            {device.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </header>

                <PreviewFrame
                  description={currentDevice.description}
                  srcDoc={previewDocument}
                  title={currentDevice.title}
                  viewportHeight={currentDevice.height}
                  viewportWidth={currentDevice.width}
                />

                <div className="preview-note">
                  <strong>Preview tecnico</strong>
                  <span>
                    Renderizacao em iframe com CSS inline. Fiel para navegador e webviews; clientes
                    com engine propria ainda exigem testes externos.
                  </span>
                </div>
              </article>
            </section>
          </section>
        )}
      </section>
    </main>
  )
}
