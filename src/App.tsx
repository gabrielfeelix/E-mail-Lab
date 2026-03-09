import { useDeferredValue, useEffect, useMemo, useState, startTransition } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FilePenLine,
  FolderOpen,
  LayoutTemplate,
  LogOut,
  Monitor,
  PanelsTopLeft,
  Plus,
  Save,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  TabletSmartphone,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import { CategoryField } from './components/CategoryField'
import { GmailPreview } from './components/GmailPreview'
import { companies, companyThemeStyle, type CompanyId } from './data/companies'
import { getCurrentSession, loadCurrentProfile, signInWithPassword, signOutCurrentUser, signUpWithPassword, subscribeToAuth } from './lib/auth-store'
import { generateEmailMarkup } from './lib/ai'
import { describeMarkup, inlineEmailDocument } from './lib/email'
import { deleteRemoteSection, loadRemoteSections, saveRemoteSection } from './lib/section-store'
import {
  buildCategoryMap,
  deleteRemoteTemplate,
  importTemplatesToRemote,
  loadRemoteWorkspace,
  saveRemoteTemplate,
} from './lib/template-store'
import type { SectionKind, SectionRecord } from './types/section'
import type { ProfileRecord } from './types/profile'
import type { TemplateRecord } from './types/template'

type AppView = 'templates' | 'details' | 'editor' | 'preview' | 'sections'
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
  useFavoriteSections: boolean
}

type SectionFormState = {
  isFavorite: boolean
  kind: SectionKind
  markup: string
  name: string
}

const STORAGE_KEYS = ['email-lab/templates-v2', 'email-lab/templates'] as const
const SELECTED_COMPANY_KEY = 'email-lab/current-company'
const DEFAULT_COMPANY_ID: CompanyId = 'pcyes'
const FALLBACK_COMPANY = companies[0]!
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const devices = {
  desktop: {
    height: 900,
    icon: Monitor,
    label: 'Notebook',
    width: 1440,
  },
  mobile: {
    height: 932,
    icon: Smartphone,
    label: 'Mobile',
    width: 430,
  },
  tablet: {
    height: 1180,
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
    useFavoriteSections: false,
  }
}

function createSectionForm(kind: SectionKind): SectionFormState {
  return {
    isFavorite: false,
    kind,
    markup: '',
    name: '',
  }
}

function buildInitialMarkup(
  useFavoriteSections: boolean,
  favoriteHeader: SectionRecord | null,
  favoriteFooter: SectionRecord | null,
) {
  if (!useFavoriteSections) {
    return ''
  }

  const chunks = [favoriteHeader?.markup.trim() ?? '', favoriteFooter?.markup.trim() ?? ''].filter(Boolean)
  return chunks.join('\n\n')
}

function createDraft(template: TemplateFormState, companyId: CompanyId, markup = ''): TemplateRecord {
  const timestamp = new Date().toISOString()

  return {
    category: template.category.trim(),
    companyId,
    createdAt: timestamp,
    id: crypto.randomUUID(),
    markup,
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
    markup: typeof record.markup === 'string' ? record.markup : '',
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
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [categoryMap, setCategoryMap] = useState<Map<CompanyId, string[]>>(() =>
    buildCategoryMap([], initialTemplates),
  )
  const [companyId, setCompanyId] = useState<CompanyId>(() => loadSelectedCompany())
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState<AppView>('templates')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateRecord | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TemplateFormState>(createBlankForm)
  const [sectionKind, setSectionKind] = useState<SectionKind>('header')
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [sectionForm, setSectionForm] = useState<SectionFormState>(() => createSectionForm('header'))
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('mobile')
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [duplicateState, setDuplicateState] = useState<DuplicateState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null)
  const [sectionDeleteTarget, setSectionDeleteTarget] = useState<SectionRecord | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiUseFavoriteHeader, setAiUseFavoriteHeader] = useState(false)
  const [aiUseFavoriteFooter, setAiUseFavoriteFooter] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [inlinedDocument, setInlinedDocument] = useState('')

  const currentCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? FALLBACK_COMPANY,
    [companyId],
  )
  const currentUserName = profile?.fullName || session?.user.user_metadata.full_name || session?.user.email || 'Conta'
  const currentUserEmail = profile?.email || session?.user.email || ''

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

  const companySections = useMemo(
    () => sections.filter((section) => section.companyId === companyId && section.kind === sectionKind),
    [companyId, sectionKind, sections],
  )

  const favoriteHeader = useMemo(
    () => sections.find((section) => section.companyId === companyId && section.kind === 'header' && section.isFavorite) ?? null,
    [companyId, sections],
  )

  const favoriteFooter = useMemo(
    () => sections.find((section) => section.companyId === companyId && section.kind === 'footer' && section.isFavorite) ?? null,
    [companyId, sections],
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

  const deferredMarkup = useDeferredValue(draft?.markup ?? '')
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

    if (view === 'sections') {
      return ['Seções']
    }

    if (view === 'preview') {
      return ['Templates', draft?.name || 'Template', 'Preview']
    }

    if (view === 'details') {
      return ['Templates', draft?.name || 'Template', 'Details']
    }

    return ['Templates', draft?.name || 'Template', 'Edit Design']
  }, [draft?.name, view])

  function handleBreadcrumbClick(index: number) {
    if (index === 0) {
      handleOpenList()
      return
    }

    if (index === 1 && draft && (view === 'editor' || view === 'details')) {
      handleOpenDetails(draft)
    }
  }

  useEffect(() => {
    let active = true

    getCurrentSession()
      .then((nextSession) => {
        if (active) {
          setSession(nextSession)
          setAuthLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setAuthLoading(false)
        }
      })

    const subscription = subscribeToAuth((nextSession) => {
      setSession(nextSession)
      setProfileMenuOpen(false)
    })

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(null)
      return
    }

    loadCurrentProfile(session.user.id)
      .then((nextProfile) => setProfile(nextProfile))
      .catch(() => setProfile(null))
  }, [session?.user.id])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(templates))
    window.localStorage.setItem(SELECTED_COMPANY_KEY, companyId)
  }, [companyId, templates])

  useEffect(() => {
    if (!session) {
      setIsHydrating(false)
      return
    }

    let cancelled = false

    async function hydrateWorkspace() {
      try {
        const [remote, remoteSections] = await Promise.all([loadRemoteWorkspace(), loadRemoteSections()])
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
        setSections(remoteSections)
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
  }, [initialTemplates, session])

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

  const persistSection = async (section: SectionRecord) => {
    setIsSaving(true)

    try {
      const saved = await saveRemoteSection(section)
      setSections((current) => {
        const next = current.filter(
          (item) => !(item.companyId === saved.companyId && item.kind === saved.kind && item.isFavorite && item.id !== saved.id && saved.isFavorite),
        )
        const exists = next.some((item) => item.id === saved.id)
        return exists ? next.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...next]
      })
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
      setPreviewModalOpen(false)
    })
  }

  const handleOpenList = () => {
    startTransition(() => {
      setView('templates')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewDevice('mobile')
      setPreviewModalOpen(false)
    })
  }

  const handleOpenSections = () => {
    startTransition(() => {
      setView('sections')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewModalOpen(false)
    })
  }

  const handleOpenCreate = () => {
    setCreateForm(createBlankForm())
    setCreateModalOpen(true)
  }

  const handleOpenSectionModal = (kind: SectionKind, section?: SectionRecord) => {
    setSectionKind(kind)
    setEditingSectionId(section?.id ?? null)
    setSectionForm(
      section
        ? {
            isFavorite: section.isFavorite,
            kind: section.kind,
            markup: section.markup,
            name: section.name,
          }
        : createSectionForm(kind),
    )
    setSectionModalOpen(true)
  }

  const handleCreateTemplate = async () => {
    if (!createForm.name.trim() || !createForm.subject.trim() || !createForm.category.trim()) {
      return
    }

    const initialMarkup = buildInitialMarkup(
      createForm.useFavoriteSections,
      favoriteHeader,
      favoriteFooter,
    )
    const nextDraft = createDraft(createForm, companyId, initialMarkup)

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
      setView('details')
      setPreviewDevice('mobile')
      setPreviewModalOpen(true)
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

  const handleSaveSection = async () => {
    if (!sectionForm.name.trim() || !sectionForm.markup.trim()) {
      return
    }

    const timestamp = new Date().toISOString()
    const section: SectionRecord = {
      companyId,
      createdAt: timestamp,
      id: editingSectionId ?? crypto.randomUUID(),
      isFavorite: sectionForm.isFavorite,
      kind: sectionForm.kind,
      markup: sectionForm.markup,
      name: sectionForm.name.trim(),
      updatedAt: timestamp,
    }

    const existing = sections.find((item) => item.id === section.id)

    try {
      await persistSection(existing ? { ...existing, ...section, createdAt: existing.createdAt } : section)
      setSectionModalOpen(false)
      setEditingSectionId(null)
      setNotice('Secao salva.')
    } catch {
      setNotice('Nao foi possivel salvar a secao.')
    }
  }

  const handleDeleteSection = async () => {
    if (!sectionDeleteTarget) {
      return
    }

    try {
      await deleteRemoteSection(sectionDeleteTarget.id)
      setSections((current) => current.filter((item) => item.id !== sectionDeleteTarget.id))
      setSectionDeleteTarget(null)
      setNotice('Secao excluida.')
    } catch {
      setNotice('Nao foi possivel excluir a secao.')
    }
  }

  const handleToggleFavoriteSection = async (section: SectionRecord) => {
    try {
      await persistSection({
        ...section,
        isFavorite: !section.isFavorite,
        updatedAt: new Date().toISOString(),
      })
      setNotice(section.isFavorite ? 'Favorito removido.' : 'Secao favoritada.')
    } catch {
      setNotice('Nao foi possivel atualizar o favorito.')
    }
  }

  const handleCopyAiPrompt = async () => {
    if (!draft) {
      return
    }

    const selectedHeader = aiUseFavoriteHeader ? favoriteHeader : null
    const selectedFooter = aiUseFavoriteFooter ? favoriteFooter : null
    const prompt = [
      `Empresa: ${currentCompany.name}`,
      `Template: ${draft.name}`,
      `Assunto: ${draft.subject}`,
      `Categoria: ${draft.category}`,
      `Objetivo do email: ${aiPrompt.trim() || 'Nao informado.'}`,
      `Use header favorito: ${selectedHeader ? selectedHeader.name : 'nao'}`,
      selectedHeader ? `Markup do header:\n${selectedHeader.markup}` : '',
      `Use footer favorito: ${selectedFooter ? selectedFooter.name : 'nao'}`,
      selectedFooter ? `Markup do footer:\n${selectedFooter.markup}` : '',
      'Gere um email HTML completo, pronto para email marketing, com CSS inline-safe e mantendo header e footer como base.',
    ]
      .filter(Boolean)
      .join('\n\n')

    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const handleOpenAiModal = () => {
    setAiError(null)
    setAiUseFavoriteHeader(Boolean(favoriteHeader))
    setAiUseFavoriteFooter(Boolean(favoriteFooter))
    setAiModalOpen(true)
  }

  const handleGenerateWithAi = async () => {
    if (!draft) {
      return
    }

    if (!aiPrompt.trim()) {
      setAiError('Descreva o email que a IA deve criar.')
      return
    }

    setAiGenerating(true)
    setAiError(null)

    try {
      const markup = await generateEmailMarkup({
        brief: aiPrompt.trim(),
        category: draft.category,
        companyName: currentCompany.name,
        favoriteFooter: aiUseFavoriteFooter ? favoriteFooter : null,
        favoriteHeader: aiUseFavoriteHeader ? favoriteHeader : null,
        subject: draft.subject,
        templateName: draft.name,
      })

      setDraft((current) => (current ? { ...current, markup } : current))
      setAiModalOpen(false)
      setNotice('Markup gerado com Gemini. Revise antes de salvar.')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Nao foi possivel gerar o template com IA.')
    } finally {
      setAiGenerating(false)
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
      setPreviewDevice(deviceId)
      setPreviewModalOpen(true)
      return
    }

    setPreviewDevice(deviceId)
  }

  const handleSignIn = async (email: string, password: string) => {
    setAuthSubmitting(true)
    try {
      await signInWithPassword(email, password)
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleSignUp = async (fullName: string, email: string, password: string) => {
    setAuthSubmitting(true)
    try {
      const nextSession = await signUpWithPassword(email, password, fullName)
      if (!nextSession) {
        setNotice('Conta criada. Se o projeto ainda exigir confirmacao, desative em Supabase Auth > Email.')
      }
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    await signOutCurrentUser()
    setView('templates')
    setDraft(null)
    setProfileMenuOpen(false)
    setSettingsOpen(false)
  }

  if (authLoading) {
    return <main className="auth-shell auth-shell--loading">Carregando...</main>
  }

  if (!session) {
    return <AuthScreen isSubmitting={authSubmitting} onSignIn={handleSignIn} onSignUp={handleSignUp} />
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
            <strong>{currentUserName}</strong>
          </span>
        </div>

        <div className="company-card">
          <span className="company-card__label">Empresa</span>
          <button className="company-card__control" onClick={() => setCompanyPickerOpen((current) => !current)} type="button">
            <span>{currentCompany.name}</span>
            <ChevronDown size={16} />
          </button>
          {companyPickerOpen && (
            <div className="company-card__menu">
              {companies.map((company) => (
                <button
                  className={`company-card__option ${company.id === companyId ? 'is-active' : ''}`.trim()}
                  key={company.id}
                  onClick={() => {
                    handleSelectCompany(company.id)
                    setCompanyPickerOpen(false)
                  }}
                  type="button"
                >
                  {company.name}
                </button>
              ))}
            </div>
          )}
        </div>

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
            <button
              className={`sidebar__nav-item ${view === 'sections' ? 'is-active' : ''}`.trim()}
              onClick={handleOpenSections}
              type="button"
            >
              <PanelsTopLeft size={18} />
              <span>Seções</span>
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
                <button
                  className={`breadcrumb__link ${index === breadcrumbs.length - 1 ? 'is-current' : ''}`.trim()}
                  disabled={index === breadcrumbs.length - 1}
                  onClick={() => handleBreadcrumbClick(index)}
                  type="button"
                >
                  {item}
                </button>
              </span>
            ))}
          </div>

          <div className="topbar__user-wrap">
          <button className="topbar__user" onClick={() => setProfileMenuOpen((current) => !current)} type="button">
            <span className="topbar__user-dot" />
            <span>{currentUserName}</span>
            <ChevronDown size={14} />
          </button>
          {profileMenuOpen && (
            <div className="topbar__menu">
              <button className="topbar__menu-item" onClick={() => { setSettingsOpen(true); setProfileMenuOpen(false) }} type="button">
                <Settings size={15} />
                Configurações
              </button>
              <button className="topbar__menu-item" onClick={handleSignOut} type="button">
                <LogOut size={15} />
                Sair
              </button>
            </div>
          )}
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

          {view === 'sections' && (
            <section className="page">
              <header className="page-heading">
                <div>
                  <h2>Seções</h2>
                  <p>{currentCompany.name}</p>
                </div>

                <button className="primary-button" onClick={() => handleOpenSectionModal(sectionKind)} type="button">
                  <Plus size={16} />
                  Nova seção
                </button>
              </header>

              <div className="section-tabs">
                <button
                  className={sectionKind === 'header' ? 'is-active' : ''}
                  onClick={() => setSectionKind('header')}
                  type="button"
                >
                  Header
                </button>
                <button
                  className={sectionKind === 'footer' ? 'is-active' : ''}
                  onClick={() => setSectionKind('footer')}
                  type="button"
                >
                  Footer
                </button>
              </div>

              {companySections.length === 0 ? (
                <section className="empty-card">
                  <FolderOpen size={30} />
                  <h3>Nenhuma secao cadastrada</h3>
                  <p>Crie {sectionKind === 'header' ? 'headers' : 'footers'} reutilizaveis para acelerar os emails.</p>
                </section>
              ) : (
                <section className="table-card">
                  <table aria-label="Lista de secoes" className="template-table">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Tipo</th>
                        <th>Favorito</th>
                        <th>Atualizado</th>
                        <th aria-label="Acoes" />
                      </tr>
                    </thead>
                    <tbody>
                      {companySections.map((section) => (
                        <tr key={section.id}>
                          <td>{section.name}</td>
                          <td>{section.kind === 'header' ? 'Header' : 'Footer'}</td>
                          <td>
                            <button
                              className={`icon-button ${section.isFavorite ? 'is-favorite' : ''}`.trim()}
                              onClick={() => handleToggleFavoriteSection(section)}
                              title="Favoritar"
                              type="button"
                            >
                              <Star size={16} />
                            </button>
                          </td>
                          <td>{dateFormatter.format(new Date(section.updatedAt))}</td>
                          <td>
                            <div className="icon-actions">
                              <button className="icon-button" onClick={() => handleOpenSectionModal(section.kind, section)} type="button">
                                <FilePenLine size={16} />
                              </button>
                              <button
                                className="icon-button icon-button--danger"
                                onClick={() => setSectionDeleteTarget(section)}
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
              <div className="details-stack">
                <section className="details-page__panel">
                  <header className="details-page__header">
                    <div>
                      <span className="details-page__eyebrow">Template</span>
                      <h2>{draft.name}</h2>
                      <p>Resumo geral do template antes de abrir a edicao.</p>
                    </div>
                  </header>

                  <div className="details-panel">
                    <div className="details-panel__header">
                      <h3>Detalhes</h3>
                    </div>
                    <dl className="details-list">
                      <div>
                        <dt>Nome</dt>
                        <dd>{draft.name}</dd>
                      </div>
                      <div>
                        <dt>Assunto</dt>
                        <dd>{draft.subject}</dd>
                      </div>
                      <div>
                        <dt>Categoria</dt>
                        <dd>{draft.category}</dd>
                      </div>
                      <div>
                        <dt>ID do template</dt>
                        <dd>{draft.id}</dd>
                      </div>
                    </dl>
                  </div>
                </section>

                <section className="details-page__panel">
                  <div className="details-panel">
                    <div className="details-panel__header">
                      <h3>Design</h3>
                      <div className="details-page__actions">
                        <button className="secondary-button" onClick={() => handleOpenPreview(draft)} type="button">
                          Preview
                        </button>
                        <button className="primary-button" onClick={handleContinueFromDetails} type="button">
                          Editar
                        </button>
                      </div>
                    </div>

                    <dl className="details-list details-list--compact">
                      <div>
                        <dt>Tipo</dt>
                        <dd>HTML</dd>
                      </div>
                      <div>
                        <dt>Ultima atualizacao</dt>
                        <dd>{dateFormatter.format(new Date(draft.updatedAt))}</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              </div>
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
                      <button onClick={handleOpenAiModal} type="button">
                        <Sparkles size={14} />
                        Criar com IA
                      </button>
                    </div>
                    <p className="editor-column__intro">Cole e edite o HTML do template.</p>
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
                    </div>

                    <div aria-label="Dispositivo" className="device-switch" role="tablist">
                      {deviceEntries.map(([deviceId, device]) => {
                        const Icon = device.icon
                        return (
                          <button
                            aria-label={device.label}
                            aria-selected={previewDevice === deviceId}
                            className={previewDevice === deviceId ? 'is-active' : ''}
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
                label="Categoria *"
                onChange={(value) =>
                  setCreateForm((current) => ({
                    ...current,
                    category: value,
                  }))
                }
                value={createForm.category}
              />

              <label className="field field--checkbox field--checkbox-card">
                <input
                  checked={createForm.useFavoriteSections}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      useFavoriteSections: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  <strong>Iniciar com header e footer favoritados</strong>
                  <small>
                    Header: {favoriteHeader?.name ?? 'nenhum'} | Footer: {favoriteFooter?.name ?? 'nenhum'}
                  </small>
                </span>
              </label>
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

      {sectionModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--wide" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>{sectionForm.kind === 'header' ? 'Header' : 'Footer'}</h3>
                <p>Cadastre uma secao reutilizavel para esta empresa.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setSectionModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>Nome *</span>
                <input
                  autoFocus
                  onChange={(event) => setSectionForm((current) => ({ ...current, name: event.target.value }))}
                  value={sectionForm.name}
                />
              </label>

              <label className="field">
                <span>Markup *</span>
                <textarea
                  className="section-textarea"
                  onChange={(event) => setSectionForm((current) => ({ ...current, markup: event.target.value }))}
                  value={sectionForm.markup}
                />
              </label>

              <label className="field field--checkbox">
                <input
                  checked={sectionForm.isFavorite}
                  onChange={(event) => setSectionForm((current) => ({ ...current, isFavorite: event.target.checked }))}
                  type="checkbox"
                />
                <span>Favoritar esta secao</span>
              </label>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setSectionModalOpen(false)} type="button">
                Cancel
              </button>
              <button className="primary-button" onClick={handleSaveSection} type="button">
                Salvar
              </button>
            </footer>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Configurações</h3>
                <p>Informações da conta autenticada.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setSettingsOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <div className="ai-summary">
                <div>
                  <span>Nome</span>
                  <strong>{currentUserName}</strong>
                </div>
                <div>
                  <span>E-mail</span>
                  <strong>{currentUserEmail}</strong>
                </div>
              </div>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setSettingsOpen(false)} type="button">
                Fechar
              </button>
              <button className="danger-button" onClick={handleSignOut} type="button">
                <LogOut size={16} />
                Sair
              </button>
            </footer>
          </section>
        </div>
      )}

      {aiModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--wide" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Criar com IA</h3>
                <p>Descreva o email e gere o HTML usando Gemini com base opcional de header e footer.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setAiModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>Briefing do e-mail</span>
                <textarea className="section-textarea" onChange={(event) => setAiPrompt(event.target.value)} value={aiPrompt} />
              </label>

              <div className="ai-summary">
                <div>
                  <span>Header favorito</span>
                  <strong>{favoriteHeader?.name ?? 'Nenhum definido'}</strong>
                </div>
                <div>
                  <span>Footer favorito</span>
                  <strong>{favoriteFooter?.name ?? 'Nenhum definido'}</strong>
                </div>
              </div>

              <div className="ai-summary">
                <label className="field field--checkbox field--checkbox-card">
                  <input
                    checked={aiUseFavoriteHeader}
                    disabled={!favoriteHeader}
                    onChange={(event) => setAiUseFavoriteHeader(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Usar header favorito</strong>
                    <small>{favoriteHeader?.name ?? 'Nenhum header favorito nesta empresa.'}</small>
                  </span>
                </label>

                <label className="field field--checkbox field--checkbox-card">
                  <input
                    checked={aiUseFavoriteFooter}
                    disabled={!favoriteFooter}
                    onChange={(event) => setAiUseFavoriteFooter(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Usar footer favorito</strong>
                    <small>{favoriteFooter?.name ?? 'Nenhum footer favorito nesta empresa.'}</small>
                  </span>
                </label>
              </div>

              {aiError && <div className="auth-card__error">{aiError}</div>}
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setAiModalOpen(false)} type="button">
                Fechar
              </button>
              <button className="primary-button" onClick={handleCopyAiPrompt} type="button">
                <Copy size={16} />
                {copied ? 'Prompt copiado' : 'Copiar prompt'}
              </button>
              <button className="primary-button" disabled={aiGenerating} onClick={handleGenerateWithAi} type="button">
                <Sparkles size={16} />
                {aiGenerating ? 'Gerando...' : 'Gerar HTML'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {previewModalOpen && draft && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--preview" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Preview</h3>
                <p>Visualizacao do template em contexto Gmail.</p>
              </div>
              <div className="modal-preview__actions">
                <div aria-label="Dispositivo" className="device-switch" role="tablist">
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
                <button aria-label="Fechar" className="icon-button" onClick={() => setPreviewModalOpen(false)} type="button">
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="modal-card__preview">
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
          </section>
        </div>
      )}

      {sectionDeleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <header className="modal-card__header">
              <h3>Excluir secao</h3>
              <button aria-label="Fechar" className="icon-button" onClick={() => setSectionDeleteTarget(null)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <p>
                Excluir <strong>{sectionDeleteTarget.name}</strong>?
              </p>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setSectionDeleteTarget(null)} type="button">
                Cancel
              </button>
              <button className="danger-button" onClick={handleDeleteSection} type="button">
                Excluir
              </button>
            </footer>
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
