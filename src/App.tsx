import { useDeferredValue, useEffect, useMemo, useRef, useState, startTransition } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  FilePenLine,
  Filter,
  FolderOpen,
  LayoutTemplate,
  LogOut,
  Monitor,
  PanelsTopLeft,
  Plus,
  Search,
  Save,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Star,
  TabletSmartphone,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { AuthScreen } from './components/AuthScreen'
import { CategoryField } from './components/CategoryField'
import { ColorTokenField } from './components/ColorTokenField'
import { GmailPreview } from './components/GmailPreview'
import { MarkupEditor } from './components/MarkupEditor'
import { companies, companyThemeStyle, type CompanyId } from './data/companies'
import { templateVariableGroups, type TemplateVariableGroup } from './data/template-variables'
import {
  getCurrentSession,
  loadCurrentMembershipCompanyIds,
  loadCurrentProfile,
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
  subscribeToAuth,
  updateCurrentUserPassword,
} from './lib/auth-store'
import { loadWorkspaceAccess, setWorkspaceCompanyAccess } from './lib/admin-access-store'
import { generateEmailMarkup } from './lib/ai'
import { loadRemoteBrandProfiles, saveRemoteBrandProfile } from './lib/brand-profile-store'
import { describeMarkup, inlineEmailDocument } from './lib/email'
import { deleteRemoteSection, loadRemoteSections, saveRemoteSection } from './lib/section-store'
import { sendTestEmail } from './lib/send-test'
import { loadRemoteTemplateVariables } from './lib/template-variable-store'
import {
  buildCategoryMap,
  deleteRemoteTemplate,
  importTemplatesToRemote,
  loadTemplateVersions,
  loadRemoteWorkspace,
  saveRemoteTemplate,
} from './lib/template-store'
import type { SectionKind, SectionRecord } from './types/section'
import type { BrandProfileRecord } from './types/brand-profile'
import type { AdminAccessRecord } from './types/admin-access'
import type { ProfileRecord } from './types/profile'
import type { TemplateRecord } from './types/template'
import type { TemplateVersionRecord } from './types/template-version'

type AppView = 'templates' | 'details' | 'editor' | 'preview' | 'sections' | 'brand' | 'variables' | 'access'
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

type BrandProfileFormState = {
  additionalContext: string
  backgroundColor: string
  exampleMarkup: string
  logoUrl: string
  primaryColor: string
  referenceImageData: string
  referenceImageName: string
  secondaryColor: string
  typography: string
}

type TemplateDateFilter = 'all' | 'today' | '7d' | '30d'

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

function createBrandProfileForm(companyId: CompanyId): BrandProfileFormState {
  const company = companies.find((item) => item.id === companyId) ?? FALLBACK_COMPANY

  return {
    additionalContext: company.note ?? '',
    backgroundColor: company.theme.bg,
    exampleMarkup: '',
    logoUrl: '',
    primaryColor: company.theme.primary,
    referenceImageData: '',
    referenceImageName: '',
    secondaryColor: company.theme.primarySoft,
    typography: 'Arial, Helvetica, sans-serif',
  }
}

function mapBrandProfileToForm(profile: BrandProfileRecord): BrandProfileFormState {
  return {
    additionalContext: profile.additionalContext,
    backgroundColor: profile.backgroundColor,
    exampleMarkup: profile.exampleMarkup,
    logoUrl: profile.logoUrl,
    primaryColor: profile.primaryColor,
    referenceImageData: profile.referenceImageData,
    referenceImageName: profile.referenceImageName,
    secondaryColor: profile.secondaryColor,
    typography: profile.typography,
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

function buildDuplicarName(name: string) {
  return `${name} copy`
}

export function App() {
  const [initialTemplates] = useState<TemplateRecord[]>(() => loadLocalTemplates())
  const [templates, setTemplates] = useState<TemplateRecord[]>(initialTemplates)
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileRecord[]>([])
  const [variableGroups, setVariableGroups] = useState<TemplateVariableGroup[]>(templateVariableGroups)
  const [categoryMap, setCategoryMap] = useState<Map<CompanyId, string[]>>(() =>
    buildCategoryMap([], initialTemplates),
  )
  const [companyId, setCompanyId] = useState<CompanyId>(() => loadSelectedCompany())
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [membershipCompanyIds, setMembershipCompanyIds] = useState<CompanyId[]>([])
  const [membershipLoaded, setMembershipLoaded] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState<AppView>('templates')
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateRecord | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState<TemplateFormState>(createBlankForm)
  const [sectionView, setSectionView] = useState<SectionKind>('header')
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [sectionForm, setSectionForm] = useState<SectionFormState>(() => createSectionForm('header'))
  const [brandProfileForm, setBrandProfileForm] = useState<BrandProfileFormState>(() => createBrandProfileForm(DEFAULT_COMPANY_ID))
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('all')
  const [templateTypeFilter, setTemplateTypeFilter] = useState<'all' | 'html'>('all')
  const [templateDateFilter, setTemplateDateFilter] = useState<TemplateDateFilter>('all')
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false)
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('mobile')
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [variableModalOpen, setVariableModalOpen] = useState(false)
  const [variableSearch, setVariableSearch] = useState('')
  const [activeVariableGroupId, setActiveVariableGroupId] = useState('')
  const [duplicateState, setDuplicateState] = useState<DuplicateState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null)
  const [sectionDeleteTarget, setSectionDeleteTarget] = useState<SectionRecord | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiUseFavoriteHeader, setAiUseFavoriteHeader] = useState(false)
  const [aiUseFavoriteFooter, setAiUseFavoriteFooter] = useState(false)
  const [aiUseCurrentMarkup, setAiUseCurrentMarkup] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [isHydrating, setIsHydrating] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingBrandProfile, setIsSavingBrandProfile] = useState(false)
  const [templateVersions, setTemplateVersions] = useState<TemplateVersionRecord[]>([])
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [accessRecords, setAccessRecords] = useState<AdminAccessRecord[]>([])
  const [accessSearch, setAccessSearch] = useState('')
  const [isLoadingAccessRecords, setIsLoadingAccessRecords] = useState(false)
  const [accessUpdateKey, setAccessUpdateKey] = useState<string | null>(null)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)
  const [settingsPassword, setSettingsPassword] = useState('')
  const [settingsPasswordConfirm, setSettingsPasswordConfirm] = useState('')
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [sendTestModalOpen, setSendTestModalOpen] = useState(false)
  const [sendTestEmailAddress, setSendTestEmailAddress] = useState('')
  const [sendTestRecipients, setSendTestRecipients] = useState<string[]>([])
  const [sendTestError, setSendTestError] = useState<string | null>(null)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [inlinedDocument, setInlinedDocument] = useState('')
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const accessibleCompanies = useMemo(() => {
    if (profile?.isAdmin) {
      return companies
    }

    if (!membershipLoaded) {
      return companies.filter((company) => company.id === companyId)
    }

    const allowed = companies.filter((company) => membershipCompanyIds.includes(company.id))
    return allowed.length > 0 ? allowed : [companies.find((company) => company.id === 'oderco') ?? FALLBACK_COMPANY]
  }, [companyId, membershipCompanyIds, membershipLoaded, profile?.isAdmin])

  const currentCompany = useMemo(() => {
    if (!membershipLoaded) {
      return companies.find((company) => company.id === companyId) ?? FALLBACK_COMPANY
    }

    return (
      accessibleCompanies.find((company) => company.id === companyId) ??
      accessibleCompanies[0] ??
      FALLBACK_COMPANY
    )
  }, [accessibleCompanies, companyId, membershipLoaded])
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

  const filteredTemplates = useMemo(() => {
    const now = Date.now()

    return companyTemplates.filter((template) => {
      const matchesSearch =
        !templateSearch.trim() ||
        [template.name, template.subject, template.category]
          .join(' ')
          .toLowerCase()
          .includes(templateSearch.trim().toLowerCase())

      const matchesCategory = templateCategoryFilter === 'all' || template.category === templateCategoryFilter
      const matchesType = templateTypeFilter === 'all' || templateTypeFilter === 'html'

      const updatedAt = new Date(template.updatedAt).getTime()
      const matchesDate =
        templateDateFilter === 'all' ||
        (templateDateFilter === 'today' &&
          new Date(template.updatedAt).toDateString() === new Date().toDateString()) ||
        (templateDateFilter === '7d' && now - updatedAt <= 7 * 24 * 60 * 60 * 1000) ||
        (templateDateFilter === '30d' && now - updatedAt <= 30 * 24 * 60 * 60 * 1000)

      return matchesSearch && matchesCategory && matchesType && matchesDate
    })
  }, [
    companyTemplates,
    templateCategoryFilter,
    templateDateFilter,
    templateSearch,
    templateTypeFilter,
  ])

  const companySections = useMemo(
    () => sections.filter((section) => section.companyId === companyId && section.kind === sectionView),
    [companyId, sectionView, sections],
  )

  const filteredAccessRecords = useMemo(() => {
    const query = accessSearch.trim().toLowerCase()

    return accessRecords.filter((record) => {
      if (!query) {
        return true
      }

      const haystack = [record.fullName, record.email, ...record.companyIds].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [accessRecords, accessSearch])

  const currentBrandProfile = useMemo(
    () => brandProfiles.find((profile) => profile.companyId === companyId) ?? null,
    [brandProfiles, companyId],
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

  const filteredVariableGroups = useMemo(() => {
    const query = variableSearch.trim().toLowerCase()

    return variableGroups
      .map((group) => ({
        ...group,
        variables: group.variables.filter((variable) => {
          if (!query) {
            return true
          }

          return [group.label, variable.label, variable.token].join(' ').toLowerCase().includes(query)
        }),
      }))
      .filter((group) => group.variables.length > 0)
  }, [variableGroups, variableSearch])

  const activeVariableGroup = useMemo(() => {
    return (
      filteredVariableGroups.find((group) => group.id === activeVariableGroupId) ??
      filteredVariableGroups[0] ??
      null
    )
  }, [activeVariableGroupId, filteredVariableGroups])

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
      return ['Secoes']
    }

    if (view === 'brand') {
      return ['Identidade visual']
    }

    if (view === 'variables') {
      return ['Variaveis']
    }

    if (view === 'access') {
      return ['Acessos']
    }

    if (view === 'preview') {
      return ['Templates', draft?.name || 'Template', 'Preview']
    }

    if (view === 'details') {
      return ['Templates', draft?.name || 'Template', 'Detalhes']
    }

    return ['Templates', draft?.name || 'Template', 'Editar design']
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
    if (!session?.user.id) {
      setMembershipCompanyIds([])
      setMembershipLoaded(false)
      return
    }

    loadCurrentMembershipCompanyIds()
      .then((companyIds) =>
        setMembershipCompanyIds(companyIds.filter((value): value is CompanyId => isCompanyId(value))),
      )
      .catch(() => setMembershipCompanyIds([]))
      .finally(() => setMembershipLoaded(true))
  }, [session?.user.id])

  useEffect(() => {
    if (!membershipLoaded) {
      return
    }

    if (!accessibleCompanies.some((company) => company.id === companyId)) {
      setCompanyId(accessibleCompanies[0]?.id ?? DEFAULT_COMPANY_ID)
    }
  }, [accessibleCompanies, companyId, membershipLoaded])

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
        const [remote, remoteSections, remoteBrandProfiles, remoteVariables] = await Promise.all([
          loadRemoteWorkspace(),
          loadRemoteSections(),
          loadRemoteBrandProfiles(),
          loadRemoteTemplateVariables(),
        ])
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
        setBrandProfiles(remoteBrandProfiles)
        setVariableGroups(remoteVariables.length > 0 ? remoteVariables : templateVariableGroups)
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
    setBrandProfileForm(currentBrandProfile ? mapBrandProfileToForm(currentBrandProfile) : createBrandProfileForm(companyId))
  }, [companyId, currentBrandProfile])

  useEffect(() => {
    if ((view !== 'editor' && view !== 'preview' && !previewModalOpen) || !draft) {
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
  }, [deferredMarkup, draft, previewModalOpen, view])

  useEffect(() => {
    if (!notice) {
      return
    }

    const timeout = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (filteredVariableGroups.length === 0) {
      if (activeVariableGroupId) {
        setActiveVariableGroupId('')
      }
      return
    }

    if (!filteredVariableGroups.some((group) => group.id === activeVariableGroupId)) {
      setActiveVariableGroupId(filteredVariableGroups[0]?.id ?? '')
    }
  }, [activeVariableGroupId, filteredVariableGroups])

  useEffect(() => {
    if (view !== 'details' || !draft?.id) {
      setTemplateVersions([])
      return
    }

    let cancelled = false
    setIsLoadingVersions(true)

    loadTemplateVersions(draft.id)
      .then((versions) => {
        if (!cancelled) {
          setTemplateVersions(versions)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTemplateVersions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingVersions(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [draft?.id, view])

  useEffect(() => {
    if (view !== 'access' || !profile?.isAdmin) {
      return
    }

    let cancelled = false
    setIsLoadingAccessRecords(true)

    loadWorkspaceAccess()
      .then((records) => {
        if (!cancelled) {
          setAccessRecords(records)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotice('Nao foi possivel carregar os acessos do workspace.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAccessRecords(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [profile?.isAdmin, view])

  useEffect(() => {
    if (view === 'access' && !profile?.isAdmin) {
      setView('templates')
    }
  }, [profile?.isAdmin, view])

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

  const persistBrandProfile = async (profile: BrandProfileRecord) => {
    setIsSavingBrandProfile(true)

    try {
      const saved = await saveRemoteBrandProfile(profile)
      setBrandProfiles((current) => {
        const next = current.filter((item) => item.companyId !== saved.companyId)
        return [saved, ...next]
      })
      return saved
    } finally {
      setIsSavingBrandProfile(false)
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

  const handleOpenBrand = () => {
    startTransition(() => {
      setView('brand')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewModalOpen(false)
    })
  }

  const handleOpenVariables = () => {
    startTransition(() => {
      setView('variables')
      setVariableSearch('')
      setActiveVariableGroupId(variableGroups[0]?.id ?? '')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewModalOpen(false)
    })
  }

  const handleOpenAccess = () => {
    startTransition(() => {
      setView('access')
      setDraft(null)
      setActiveTemplateId(null)
      setPreviewModalOpen(false)
    })
  }

  const handleToggleWorkspaceAccess = async (userId: string, targetCompanyId: CompanyId, enabled: boolean) => {
    const updateKey = `${userId}:${targetCompanyId}`
    setAccessUpdateKey(updateKey)

    try {
      await setWorkspaceCompanyAccess(userId, targetCompanyId, enabled)
      setAccessRecords((current) =>
        current.map((record) => {
          if (record.userId !== userId) {
            return record
          }

          const nextCompanyIds = enabled
            ? [...new Set([...record.companyIds, targetCompanyId])].sort((left, right) => left.localeCompare(right))
            : record.companyIds.filter((company) => company !== targetCompanyId)

          return {
            ...record,
            companyIds: nextCompanyIds,
          }
        }),
      )
      setNotice(enabled ? 'Acesso liberado para a empresa.' : 'Acesso removido da empresa.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Nao foi possivel atualizar o acesso do usuario.')
    } finally {
      setAccessUpdateKey(null)
    }
  }

  const handleSaveBrandProfile = async () => {
    const timestamp = new Date().toISOString()
    const nextProfile: BrandProfileRecord = {
      additionalContext: brandProfileForm.additionalContext.trim(),
      backgroundColor: brandProfileForm.backgroundColor.trim(),
      companyId,
      createdAt: currentBrandProfile?.createdAt ?? timestamp,
      exampleMarkup: brandProfileForm.exampleMarkup,
      id: currentBrandProfile?.id ?? crypto.randomUUID(),
      logoUrl: brandProfileForm.logoUrl.trim(),
      primaryColor: brandProfileForm.primaryColor.trim(),
      referenceImageData: brandProfileForm.referenceImageData,
      referenceImageName: brandProfileForm.referenceImageName,
      secondaryColor: brandProfileForm.secondaryColor.trim(),
      typography: brandProfileForm.typography.trim(),
      updatedAt: timestamp,
    }

    try {
      await persistBrandProfile(nextProfile)
      setNotice('Identidade visual salva.')
    } catch {
      setNotice('Nao foi possivel salvar a identidade visual.')
    }
  }

  const handleBrandReferenceImageChange = async (file: File | null) => {
    if (!file) {
      setBrandProfileForm((current) => ({
        ...current,
        referenceImageData: '',
        referenceImageName: '',
      }))
      return
    }

    const reader = new FileReader()

    await new Promise<void>((resolve, reject) => {
      reader.onload = () => {
        setBrandProfileForm((current) => ({
          ...current,
          referenceImageData: typeof reader.result === 'string' ? reader.result : '',
          referenceImageName: file.name,
        }))
        resolve()
      }

      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const handleOpenCreate = () => {
    setCreateForm(createBlankForm())
    setCreateModalOpen(true)
  }

  const handleOpenSectionModal = (kind: SectionKind, section?: SectionRecord) => {
    setSectionView(kind)
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

  const handleContinuarFromDetails = () => {
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

  const handleRestoreVersion = async (version: TemplateVersionRecord) => {
    if (!draft) {
      return
    }

    const restoredDraft: TemplateRecord = {
      ...draft,
      category: version.category,
      markup: version.markup,
      name: version.name,
      subject: version.subject,
      updatedAt: new Date().toISOString(),
    }

    try {
      const saved = await persistTemplate(restoredDraft)
      setDraft(saved)
      setNotice(`Versao ${version.versionNumber} restaurada.`)
    } catch {
      setNotice('Nao foi possivel restaurar a versao selecionada.')
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

  const handleOpenAiModal = () => {
    setAiError(null)
    setAiUseFavoriteHeader(Boolean(favoriteHeader))
    setAiUseFavoriteFooter(Boolean(favoriteFooter))
    setAiUseCurrentMarkup(Boolean(draft?.markup.trim()))
    setAiModalOpen(true)
  }

  const handleOpenVariableModal = () => {
    setVariableSearch('')
    setActiveVariableGroupId(variableGroups[0]?.id ?? '')
    setVariableModalOpen(true)
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
        brandProfile: currentBrandProfile,
        category: draft.category,
        companyName: currentCompany.name,
        currentMarkup: aiUseCurrentMarkup ? draft.markup : '',
        favoriteFooter: aiUseFavoriteFooter ? favoriteFooter : null,
        favoriteHeader: aiUseFavoriteHeader ? favoriteHeader : null,
        mode: aiUseCurrentMarkup ? 'variation' : 'create',
        subject: draft.subject,
        templateVariables: variableGroups,
        templateName: draft.name,
      })

      const nextDraft: TemplateRecord = {
        ...draft,
        markup,
        updatedAt: new Date().toISOString(),
      }

      setDraft(nextDraft)
      setAiModalOpen(false)
      setNotice(aiUseCurrentMarkup ? 'Variacao gerada com Gemini. Clique em Salvar para persistir.' : 'Markup gerado com Gemini. Clique em Salvar para persistir.')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Nao foi possivel gerar o template com IA.')
    } finally {
      setAiGenerating(false)
    }
  }

  const handleOpenSendTestModal = () => {
    setSendTestEmailAddress(currentUserEmail)
    setSendTestRecipients(currentUserEmail ? [currentUserEmail] : [])
    setSendTestError(null)
    setSendTestModalOpen(true)
  }

  const handleSendTestEmail = async () => {
    if (!draft || !session?.access_token) {
      setSendTestError('Sua sessao expirou. Entre novamente para enviar um teste.')
      return
    }

    if (sendTestRecipients.length === 0) {
      setSendTestError('Informe um email de destino para o teste.')
      return
    }

    if (!draft.markup.trim()) {
      setSendTestError('O template esta vazio. Salve ou gere um markup antes de enviar.')
      return
    }

    setIsSendingTest(true)
    setSendTestError(null)

    try {
      await sendTestEmail(session.access_token, {
        companyId: draft.companyId,
        markup: draft.markup,
        subject: draft.subject,
        toEmails: sendTestRecipients,
      })
      setSendTestModalOpen(false)
      setNotice('Email de teste enviado.')
    } catch (error) {
      setSendTestError(error instanceof Error ? error.message : 'Nao foi possivel enviar o email de teste.')
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleAddSendTestRecipient = (email: string) => {
    const normalized = email.trim().toLowerCase()

    if (!normalized) {
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setSendTestError('Informe um email valido para adicionar na lista.')
      return
    }

    setSendTestRecipients((current) =>
      current.includes(normalized) ? current : [...current, normalized],
    )
    setSendTestEmailAddress('')
    setSendTestError(null)
  }

  const handleRemoveSendTestRecipient = (email: string) => {
    setSendTestRecipients((current) => current.filter((item) => item !== email))
  }

  const handleCopyMarkup = async () => {
    if (!draft) {
      return
    }

    await navigator.clipboard.writeText(draft.markup)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  const handleCopyVariable = async (token: string) => {
    await navigator.clipboard.writeText(token)
    setNotice('Variavel copiada.')
  }

  const handleInsertVariable = (token: string) => {
    if (!draft) {
      return
    }

    const textarea = editorTextareaRef.current
    const selectionStart = textarea?.selectionStart ?? draft.markup.length
    const selectionEnd = textarea?.selectionEnd ?? draft.markup.length
    const nextMarkup =
      draft.markup.slice(0, selectionStart) + token + draft.markup.slice(selectionEnd)
    const nextCursor = selectionStart + token.length

    setDraft((current) => (current ? { ...current, markup: nextMarkup } : current))
    setVariableModalOpen(false)

    window.requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(nextCursor, nextCursor)
    })
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
    setMembershipCompanyIds([])
    setAccessRecords([])
    setProfileMenuOpen(false)
    setSettingsOpen(false)
  }

  const handleUpdatePassword = async () => {
    if (!settingsPassword || !settingsPasswordConfirm) {
      setSettingsError('Preencha a nova senha e a confirmacao.')
      return
    }

    if (settingsPassword !== settingsPasswordConfirm) {
      setSettingsError('As senhas nao conferem.')
      return
    }

    if (settingsPassword.length < 6) {
      setSettingsError('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }

    setIsUpdatingPassword(true)
    setSettingsError(null)

    try {
      await updateCurrentUserPassword(settingsPassword)
      setSettingsPassword('')
      setSettingsPasswordConfirm('')
      setNotice('Senha atualizada com sucesso.')
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Nao foi possivel atualizar a senha.')
    } finally {
      setIsUpdatingPassword(false)
    }
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
              {accessibleCompanies.map((company) => (
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
              <span>Secoes</span>
            </button>
            <button
              className={`sidebar__nav-item ${view === 'variables' ? 'is-active' : ''}`.trim()}
              onClick={handleOpenVariables}
              type="button"
            >
              <Braces size={18} />
              <span>Variaveis</span>
            </button>
            {profile?.isAdmin && (
              <button
                className={`sidebar__nav-item ${view === 'access' ? 'is-active' : ''}`.trim()}
                onClick={handleOpenAccess}
                type="button"
              >
                <Users size={18} />
                <span>Acessos</span>
              </button>
            )}
          </nav>
        </div>

        <div className="sidebar__group">
          <span className="sidebar__group-label">Marca</span>
          <nav aria-label="Marca" className="sidebar__nav">
            <button
              className={`sidebar__nav-item ${view === 'brand' ? 'is-active' : ''}`.trim()}
              onClick={handleOpenBrand}
              type="button"
            >
              <Settings size={18} />
              <span>Identidade visual</span>
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
                Configuracoes
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
                  Novo template
                </button>
              </header>

              <section className="filters-bar">
                <label className="filters-search">
                  <Search size={16} />
                  <input
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Buscar por nome, assunto ou categoria"
                    value={templateSearch}
                  />
                </label>

                <div className="filters-group">
                  <label className="filters-select">
                    <Filter size={16} />
                    <select
                      onChange={(event) => setTemplateCategoryFilter(event.target.value)}
                      value={templateCategoryFilter}
                    >
                      <option value="all">Todas as categorias</option>
                      {availableCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="filters-select">
                    <select onChange={(event) => setTemplateTypeFilter(event.target.value as 'all' | 'html')} value={templateTypeFilter}>
                      <option value="all">Todos os tipos</option>
                      <option value="html">HTML</option>
                    </select>
                  </label>

                  <label className="filters-select">
                    <select onChange={(event) => setTemplateDateFilter(event.target.value as TemplateDateFilter)} value={templateDateFilter}>
                      <option value="all">Qualquer data</option>
                      <option value="today">Hoje</option>
                      <option value="7d">Ultimos 7 dias</option>
                      <option value="30d">Ultimos 30 dias</option>
                    </select>
                  </label>
                </div>
              </section>

              {isHydrating ? (
                <section className="empty-card">
                  <h3>Carregando templates</h3>
                  <p>Sincronizando os dados do Supabase para esta empresa.</p>
                </section>
              ) : companyTemplates.length === 0 ? (
                <section className="empty-card">
                  <FolderOpen size={30} />
                  <h3>Voce ainda nao tem templates de email</h3>
                  <p>Crie o primeiro template de {currentCompany.name} para comecar a trabalhar no editor.</p>
                </section>
              ) : filteredTemplates.length === 0 ? (
                <section className="empty-card">
                  <Filter size={30} />
                  <h3>Nenhum template encontrado</h3>
                  <p>Ajuste os filtros para encontrar um template desta empresa.</p>
                </section>
              ) : (
                <section className="table-card">
                  <table aria-label="Lista de templates" className="template-table">
                    <thead>
                      <tr>
                        <th>Nome do template</th>
                        <th>Tipo</th>
                        <th>Categoria</th>
                        <th>Ultima atualizacao</th>
                        <th aria-label="Acoes" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map((template) => (
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
                                    name: buildDuplicarName(template.name),
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
                  <h2>Secoes</h2>
                  <p>{currentCompany.name}</p>
                </div>

                <button className="primary-button" onClick={() => handleOpenSectionModal(sectionView)} type="button">
                  <Plus size={16} />
                  Nova secao
                </button>
              </header>

              <div className="section-tabs">
                <button
                  className={sectionView === 'header' ? 'is-active' : ''}
                  onClick={() => setSectionView('header')}
                  type="button"
                >
                  Header
                </button>
                <button
                  className={sectionView === 'footer' ? 'is-active' : ''}
                  onClick={() => setSectionView('footer')}
                  type="button"
                >
                  Footer
                </button>
              </div>

              {companySections.length === 0 ? (
                <section className="empty-card">
                  <FolderOpen size={30} />
                  <h3>Nenhuma secao cadastrada</h3>
                  <p>Crie {sectionView === 'header' ? 'headers' : 'footers'} reutilizaveis para acelerar os emails.</p>
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

          {view === 'brand' && (
            <section className="page">
              <header className="page-heading">
                <div>
                  <h2>Identidade visual</h2>
                  <p>{currentCompany.name}</p>
                </div>

                <button
                  className="primary-button"
                  disabled={isSavingBrandProfile}
                  onClick={handleSaveBrandProfile}
                  type="button"
                >
                  <Save size={16} />
                  {isSavingBrandProfile ? 'Salvando' : 'Salvar identidade'}
                </button>
              </header>

              <section className="details-page__panel">
                <div className="details-panel brand-panel">
                  <div className="details-panel__header">
                    <div>
                      <h3>Contexto da marca</h3>
                      <p>Esses dados alimentam a IA e ajudam a manter consistencia visual da empresa.</p>
                    </div>
                  </div>

                  <div className="brand-grid">
                    <label className="field">
                      <span>Link da logo</span>
                      <input
                        onChange={(event) => setBrandProfileForm((current) => ({ ...current, logoUrl: event.target.value }))}
                        placeholder="https://..."
                        value={brandProfileForm.logoUrl}
                      />
                    </label>

                    <label className="field">
                      <span>Tipografia</span>
                      <input
                        onChange={(event) => setBrandProfileForm((current) => ({ ...current, typography: event.target.value }))}
                        placeholder="Arial, Helvetica, sans-serif"
                        value={brandProfileForm.typography}
                      />
                    </label>

                    <ColorTokenField
                      label="Cor primaria"
                      onChange={(value) => setBrandProfileForm((current) => ({ ...current, primaryColor: value }))}
                      value={brandProfileForm.primaryColor}
                    />

                    <ColorTokenField
                      label="Cor secundaria"
                      onChange={(value) => setBrandProfileForm((current) => ({ ...current, secondaryColor: value }))}
                      value={brandProfileForm.secondaryColor}
                    />

                    <ColorTokenField
                      label="Background"
                      onChange={(value) => setBrandProfileForm((current) => ({ ...current, backgroundColor: value }))}
                      value={brandProfileForm.backgroundColor}
                    />
                  </div>

                  <label className="field field--file">
                    <span>Print de referencia para a IA</span>
                    <input
                      accept="image/*"
                      onChange={(event) => void handleBrandReferenceImageChange(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                    <small>{brandProfileForm.referenceImageName || 'Nenhum arquivo enviado.'}</small>
                  </label>

                  <label className="field">
                    <span>Diretrizes extras</span>
                    <textarea
                      className="section-textarea"
                      onChange={(event) =>
                        setBrandProfileForm((current) => ({ ...current, additionalContext: event.target.value }))
                      }
                      placeholder="Tom de voz, regras de layout, estilo de botao, uso de imagens e restricoes."
                      value={brandProfileForm.additionalContext}
                    />
                  </label>

                  <label className="field">
                    <span>Exemplo de email</span>
                    <textarea
                      className="section-textarea"
                      onChange={(event) =>
                        setBrandProfileForm((current) => ({ ...current, exampleMarkup: event.target.value }))
                      }
                      placeholder="Cole um HTML de exemplo para servir de referencia para a IA."
                      value={brandProfileForm.exampleMarkup}
                    />
                  </label>
                </div>
              </section>
            </section>
          )}

          {view === 'variables' && (
            <section className="page">
              <header className="page-heading">
                <div>
                  <h2>Variaveis</h2>
                  <p>Catalogo Magento para inserir tokens sem digitar na mao.</p>
                </div>
              </header>

              <section className="filters-bar">
                <label className="filters-search">
                  <Search size={16} />
                  <input
                    onChange={(event) => setVariableSearch(event.target.value)}
                    placeholder="Buscar por nome, grupo ou token"
                    value={variableSearch}
                  />
                </label>
              </section>

              {filteredVariableGroups.length > 0 && (
                <div className="variable-tabs" role="tablist">
                  {filteredVariableGroups.map((group) => (
                    <button
                      aria-selected={activeVariableGroup?.id === group.id}
                      className={activeVariableGroup?.id === group.id ? 'is-active' : ''}
                      key={group.id}
                      onClick={() => setActiveVariableGroupId(group.id)}
                      role="tab"
                      type="button"
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              )}

              {filteredVariableGroups.length === 0 ? (
                <section className="empty-card">
                  <Filter size={30} />
                  <h3>Nenhuma variavel encontrada</h3>
                  <p>Ajuste a busca para encontrar o token Magento desejado.</p>
                </section>
              ) : (
                <section className="variable-catalog">
                  {activeVariableGroup && (
                    <article className="details-panel variable-group" key={activeVariableGroup.id}>
                      <div className="details-panel__header">
                        <div>
                          <h3>{activeVariableGroup.label}</h3>
                          <p>{activeVariableGroup.variables.length} variaveis disponiveis</p>
                        </div>
                      </div>

                      <div className="variable-list">
                        {activeVariableGroup.variables.map((variable) => (
                          <div className="variable-row" key={variable.id}>
                            <div className="variable-row__meta">
                              <strong>{variable.label}</strong>
                              <button
                                className="variable-token"
                                onClick={() => void handleCopyVariable(variable.token)}
                                title="Copiar token"
                                type="button"
                              >
                                {variable.token}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  )}
                </section>
              )}
            </section>
          )}

          {view === 'access' && profile?.isAdmin && (
            <section className="page">
              <header className="page-heading">
                <div>
                  <h2>Acessos</h2>
                  <p>Controle quais empresas cada usuario pode abrir no workspace.</p>
                </div>
              </header>

              <section className="filters-bar">
                <label className="filters-search">
                  <Search size={16} />
                  <input
                    onChange={(event) => setAccessSearch(event.target.value)}
                    placeholder="Buscar por nome, email ou empresa"
                    value={accessSearch}
                  />
                </label>
              </section>

              {isLoadingAccessRecords ? (
                <section className="empty-card">
                  <h3>Carregando acessos</h3>
                  <p>Buscando usuarios e memberships do workspace.</p>
                </section>
              ) : filteredAccessRecords.length === 0 ? (
                <section className="empty-card">
                  <Users size={30} />
                  <h3>Nenhum usuario encontrado</h3>
                  <p>Ajuste a busca para encontrar um usuario do workspace.</p>
                </section>
              ) : (
                <section className="access-grid">
                  {filteredAccessRecords.map((record) => (
                    <article className="access-card" key={record.userId}>
                      <div className="access-card__header">
                        <div>
                          <h3>{record.fullName}</h3>
                          <p>{record.email}</p>
                        </div>
                        {record.isAdmin && <span className="access-card__badge">Admin</span>}
                      </div>

                      <div className="access-card__companies">
                        {companies.map((company) => {
                          const checked = record.companyIds.includes(company.id)
                          const updateKey = `${record.userId}:${company.id}`

                          return (
                            <label className="access-company" key={company.id}>
                              <input
                                checked={checked}
                                disabled={record.isAdmin || accessUpdateKey === updateKey}
                                onChange={(event) =>
                                  void handleToggleWorkspaceAccess(record.userId, company.id, event.target.checked)
                                }
                                type="checkbox"
                              />
                              <span>{company.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </article>
                  ))}
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
                        <button className="secondary-button" onClick={handleOpenSendTestModal} type="button">
                          <Send size={16} />
                          Enviar teste
                        </button>
                        <button className="primary-button" onClick={handleContinuarFromDetails} type="button">
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

                <section className="details-page__panel">
                  <div className="details-panel">
                    <div className="details-panel__header">
                      <h3>Historico</h3>
                    </div>

                    {isLoadingVersions ? (
                      <p>Carregando versoes salvas deste template.</p>
                    ) : templateVersions.length === 0 ? (
                      <p>Nenhuma versao registrada ainda.</p>
                    ) : (
                      <div className="version-list">
                        {templateVersions.map((version) => (
                          <article className="version-card" key={version.id}>
                            <div className="version-card__meta">
                              <strong>Versao {version.versionNumber}</strong>
                              <span>{dateFormatter.format(new Date(version.createdAt))}</span>
                            </div>
                            <div className="version-card__info">
                              <span>{version.name}</span>
                              <span>{version.subject}</span>
                              <span>{version.category}</span>
                            </div>
                            <button
                              className="secondary-button"
                              onClick={() => handleRestoreVersion(version)}
                              type="button"
                            >
                              Restaurar
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
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
                      <button onClick={handleOpenVariableModal} type="button">
                        <Braces size={14} />
                        Adicionar variavel
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

                    <MarkupEditor
                      onChange={(value) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                markup: value,
                              }
                            : current,
                        )
                      }
                      textareaRef={editorTextareaRef}
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

              {!aiModalOpen && !variableModalOpen && (
                <footer className="bottom-bar">
                <button className="secondary-button" onClick={() => setView('details')} type="button">
                  Cancelar
                </button>
                <button className="secondary-button" onClick={handleOpenSendTestModal} type="button">
                  <Send size={16} />
                  Enviar teste
                </button>
                <button className="secondary-button" onClick={handleCopyMarkup} type="button">
                  <Copy size={16} />
                  {copied ? 'Copiado' : 'Copiar markup'}
                </button>
                <button className="primary-button" disabled={!isDirty || isSaving} onClick={handleSaveDraft} type="button">
                  <Save size={16} />
                  {isSaving ? 'Salvando' : 'Salvar'}
                </button>
                <span className="bottom-bar__status">{isDirty ? 'Nao salvo' : 'Salvo'}</span>
                </footer>
              )}
            </section>
          )}
        </div>
      </section>

      {createModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--wide" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Detalhes do template</h3>
                <p>Preencha os dados principais e continue para o editor.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setCreateModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>Nome do template *</span>
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
                <span>Assunto *</span>
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
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={!createForm.name.trim() || !createForm.subject.trim() || !createForm.category.trim() || isSaving}
                onClick={handleCreateTemplate}
                type="button"
              >
                Continuar
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
                Cancelar
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
          <section aria-modal="true" className="modal-card modal-card--settings" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Configuracoes</h3>
                <p>Informacoes da conta autenticada e seguranca de acesso.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setSettingsOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body modal-card__body--settings">
              <div className="settings-grid">
                <label className="field">
                  <span>Nome</span>
                  <input disabled value={currentUserName} />
                </label>
                <label className="field">
                  <span>E-mail</span>
                  <input disabled value={currentUserEmail} />
                </label>
              </div>

              <div className="settings-password">
                <div>
                  <h4>Alterar senha</h4>
                  <p>Defina uma nova senha para esta conta corporativa.</p>
                </div>

                <div className="settings-grid">
                  <label className="field">
                    <span>Nova senha</span>
                    <input
                      onChange={(event) => setSettingsPassword(event.target.value)}
                      type="password"
                      value={settingsPassword}
                    />
                  </label>
                  <label className="field">
                    <span>Confirmar nova senha</span>
                    <input
                      onChange={(event) => setSettingsPasswordConfirm(event.target.value)}
                      type="password"
                      value={settingsPasswordConfirm}
                    />
                  </label>
                </div>

                {settingsError && <div className="auth-card__error">{settingsError}</div>}
              </div>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setSettingsOpen(false)} type="button">
                Fechar
              </button>
              <button className="secondary-button" disabled={isUpdatingPassword} onClick={handleUpdatePassword} type="button">
                {isUpdatingPassword ? 'Atualizando...' : 'Salvar nova senha'}
              </button>
              <button className="danger-button" onClick={handleSignOut} type="button">
                <LogOut size={16} />
                Sair
              </button>
            </footer>
          </section>
        </div>
      )}

      {variableModalOpen && draft && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--wide" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Inserir variavel</h3>
                <p>Escolha um token Magento e insira no cursor atual do codigo.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setVariableModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="filters-search filters-search--modal">
                <Search size={16} />
                <input
                  autoFocus
                  onChange={(event) => setVariableSearch(event.target.value)}
                  placeholder="Buscar por nome, grupo ou token"
                  value={variableSearch}
                />
              </label>

              {filteredVariableGroups.length > 0 && (
                <div className="variable-tabs variable-tabs--modal" role="tablist">
                  {filteredVariableGroups.map((group) => (
                    <button
                      aria-selected={activeVariableGroup?.id === group.id}
                      className={activeVariableGroup?.id === group.id ? 'is-active' : ''}
                      key={group.id}
                      onClick={() => setActiveVariableGroupId(group.id)}
                      role="tab"
                      type="button"
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              )}

              {filteredVariableGroups.length === 0 ? (
                <div className="empty-card empty-card--inline">
                  <Filter size={24} />
                  <h3>Nenhuma variavel encontrada</h3>
                  <p>Ajuste a busca para localizar o token.</p>
                </div>
              ) : (
                <div className="variable-catalog variable-catalog--modal">
                  {activeVariableGroup && (
                    <article className="variable-group variable-group--modal" key={activeVariableGroup.id}>
                      <div className="variable-group__header">
                        <strong>{activeVariableGroup.label}</strong>
                      </div>

                      <div className="variable-list">
                        {activeVariableGroup.variables.map((variable) => (
                          <button
                            className="variable-row variable-row--interactive"
                            key={variable.id}
                            onClick={() => handleInsertVariable(variable.token)}
                            type="button"
                          >
                            <div className="variable-row__meta">
                              <strong>{variable.label}</strong>
                              <span className="variable-token">{variable.token}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </article>
                  )}
                </div>
              )}
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setVariableModalOpen(false)} type="button">
                Fechar
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
                <p>Descreva o email. O prompt base fica no backend e usa a identidade visual, exemplos e favoritos desta empresa.</p>
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

              <div className="ai-options ai-options--compact">
                <label className="ai-option">
                  <input
                    checked={aiUseCurrentMarkup}
                    disabled={!draft?.markup.trim()}
                    onChange={(event) => setAiUseCurrentMarkup(event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Usar template atual como base</strong>
                    <small className="ai-option__detail">
                      {draft?.markup.trim()
                        ? 'A IA cria uma variacao reaproveitando a estrutura atual.'
                        : 'Este template ainda nao tem markup salvo para servir como base.'}
                    </small>
                  </div>
                </label>

                <label className="ai-option">
                  <input
                    checked={aiUseFavoriteHeader}
                    disabled={!favoriteHeader}
                    onChange={(event) => setAiUseFavoriteHeader(event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Usar header favorito</strong>
                    <small className="ai-option__detail">{favoriteHeader?.name ?? 'Nenhum header favorito nesta empresa.'}</small>
                  </div>
                </label>

                <label className="ai-option">
                  <input
                    checked={aiUseFavoriteFooter}
                    disabled={!favoriteFooter}
                    onChange={(event) => setAiUseFavoriteFooter(event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Usar footer favorito</strong>
                    <small className="ai-option__detail">{favoriteFooter?.name ?? 'Nenhum footer favorito nesta empresa.'}</small>
                  </div>
                </label>
              </div>

              <div className="ai-brand-note">
                <span>Identidade visual</span>
                <strong>{currentBrandProfile ? 'Contexto salvo e ativo para esta empresa.' : 'Sem contexto salvo; a IA usara apenas o tema base da empresa.'}</strong>
              </div>

              {aiError && <div className="auth-card__error">{aiError}</div>}
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setAiModalOpen(false)} type="button">
                Fechar
              </button>
              <button className="primary-button" disabled={aiGenerating} onClick={handleGenerateWithAi} type="button">
                <Sparkles size={16} />
                {aiGenerating ? 'Gerando...' : aiUseCurrentMarkup ? 'Gerar variacao' : 'Gerar HTML'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {sendTestModalOpen && draft && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card--wide" role="dialog">
            <header className="modal-card__header">
              <div>
                <h3>Enviar teste</h3>
                <p>Dispare uma copia real do template atual para validar o HTML em uma caixa de entrada.</p>
              </div>
              <button aria-label="Fechar" className="icon-button" onClick={() => setSendTestModalOpen(false)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>Email de destino</span>
                <div className="send-test-input">
                  <input
                    autoFocus
                    onChange={(event) => setSendTestEmailAddress(event.target.value)}
                    placeholder="voce@empresa.com"
                    type="email"
                    value={sendTestEmailAddress}
                  />
                  <button
                    className="secondary-button"
                    onClick={() => handleAddSendTestRecipient(sendTestEmailAddress)}
                    type="button"
                  >
                    Adicionar
                  </button>
                </div>
              </label>

              <div className="send-test-suggestions">
                <button
                  className="secondary-button"
                  onClick={() => handleAddSendTestRecipient('rodrigo.leite@oderco.com.br')}
                  type="button"
                >
                  rodrigo.leite@oderco.com.br
                </button>
                {currentUserEmail && (
                  <button
                    className="secondary-button"
                    onClick={() => handleAddSendTestRecipient(currentUserEmail)}
                    type="button"
                  >
                    {currentUserEmail}
                  </button>
                )}
              </div>

              {sendTestRecipients.length > 0 && (
                <div className="send-test-recipients">
                  {sendTestRecipients.map((email) => (
                    <div className="send-test-recipient" key={email}>
                      <span>{email}</span>
                      <button
                        aria-label={`Remover ${email}`}
                        className="icon-button"
                        onClick={() => handleRemoveSendTestRecipient(email)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="ai-brand-note">
                <span>Assunto enviado</span>
                <strong>{draft.subject || 'Sem assunto'}</strong>
              </div>

              {sendTestError && <div className="auth-card__error">{sendTestError}</div>}
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setSendTestModalOpen(false)} type="button">
                Cancelar
              </button>
              <button className="primary-button" disabled={isSendingTest} onClick={handleSendTestEmail} type="button">
                <Send size={16} />
                {isSendingTest ? 'Enviando...' : 'Enviar agora'}
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
                Cancelar
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
              <h3>Duplicar template</h3>
              <button aria-label="Fechar" className="icon-button" onClick={() => setDuplicateState(null)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <label className="field">
                <span>Novo nome do template</span>
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
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={isSaving || !duplicateState.name.trim()}
                onClick={handleDuplicate}
                type="button"
              >
                Duplicar
              </button>
            </footer>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <header className="modal-card__header">
              <h3>Excluir template</h3>
              <button aria-label="Fechar" className="icon-button" onClick={() => setDeleteTarget(null)} type="button">
                <X size={16} />
              </button>
            </header>

            <div className="modal-card__body">
              <p>
                Excluir <strong>{deleteTarget.name}</strong>? Esta acao remove o template da lista atual.
              </p>
            </div>

            <footer className="modal-card__actions">
              <button className="secondary-button" onClick={() => setDeleteTarget(null)} type="button">
                Cancelar
              </button>
              <button className="danger-button" disabled={isSaving} onClick={handleDeleteTemplate} type="button">
                Excluir
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}
