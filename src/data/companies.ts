import type { CSSProperties } from 'react'

export type CompanyId =
  | 'pcyes'
  | 'oderco'
  | 'azux'
  | 'crm'
  | 'odex'
  | 'tonante'
  | 'quati'
  | 'skul'
  | 'vinik'

export type CompanyTheme = {
  bg: string
  border: string
  borderStrong: string
  ink: string
  muted: string
  primary: string
  primarySoft: string
  primaryStrong: string
  sidebar: string
  sidebarBorder: string
  sidebarMuted: string
  sidebarText: string
  surface: string
  surfaceAlt: string
  surfaceMuted: string
}

export type CompanyDefinition = {
  categories: string[]
  id: CompanyId
  name: string
  note?: string
  theme: CompanyTheme
}

export const companies: CompanyDefinition[] = [
  {
    categories: ['Institucional', 'Newsletter', 'Promocional', 'Lançamento', 'Suporte'],
    id: 'pcyes',
    name: 'PCYES',
    note: 'Primária inferida a partir do logo vermelho atual.',
    theme: {
      bg: '#f4f5f7',
      border: '#dadada',
      borderStrong: '#bdbdbd',
      ink: '#111111',
      muted: '#6f6f6f',
      primary: '#c91818',
      primarySoft: '#f5e9e9',
      primaryStrong: '#8e0f0f',
      sidebar: '#000000',
      sidebarBorder: '#1f1f1f',
      sidebarMuted: '#9b9b9b',
      sidebarText: '#f7f7f7',
      surface: '#ffffff',
      surfaceAlt: '#f7f7f7',
      surfaceMuted: '#efefef',
    },
  },
  {
    categories: ['Institucional', 'Comercial', 'Cobrança', 'Onboarding', 'Suporte'],
    id: 'oderco',
    name: 'ODERÇO',
    theme: {
      bg: '#ffffff',
      border: '#d8e2f5',
      borderStrong: '#bdd0f0',
      ink: '#0d1d52',
      muted: '#53658f',
      primary: '#0d1d52',
      primarySoft: '#e5efff',
      primaryStrong: '#09133a',
      sidebar: '#0d1d52',
      sidebarBorder: '#182a67',
      sidebarMuted: '#b6c7ec',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f7faff',
      surfaceMuted: '#edf3ff',
    },
  },
  {
    categories: ['Newsletter', 'Produtos', 'Suporte', 'Comunicado'],
    id: 'azux',
    name: 'AZUX',
    theme: {
      bg: '#f4f8fc',
      border: '#d2e6f0',
      borderStrong: '#b5d5e7',
      ink: '#0e2746',
      muted: '#53718e',
      primary: '#0256a3',
      primarySoft: '#e6f3fb',
      primaryStrong: '#013b71',
      sidebar: '#0256a3',
      sidebarBorder: '#0b66b4',
      sidebarMuted: '#b7d8ea',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f7fbfe',
      surfaceMuted: '#ebf6fb',
    },
  },
  {
    categories: ['CRM', 'Fluxo', 'Reativação', 'Relacionamento'],
    id: 'crm',
    name: 'CRM',
    theme: {
      bg: '#f5f5f5',
      border: '#d8dde5',
      borderStrong: '#c1cad7',
      ink: '#001233',
      muted: '#5e6777',
      primary: '#001233',
      primarySoft: '#e8edf5',
      primaryStrong: '#000b1f',
      sidebar: '#001233',
      sidebarBorder: '#102146',
      sidebarMuted: '#9ea9c0',
      sidebarText: '#f5f5f5',
      surface: '#ffffff',
      surfaceAlt: '#fafafa',
      surfaceMuted: '#f0f2f5',
    },
  },
  {
    categories: ['Institucional', 'Produto', 'Operacional', 'Suporte'],
    id: 'odex',
    name: 'ODEX',
    theme: {
      bg: '#f6f8ff',
      border: '#d7def7',
      borderStrong: '#c2cdf2',
      ink: '#0d1d52',
      muted: '#536087',
      primary: '#0d1d52',
      primarySoft: '#e8efff',
      primaryStrong: '#081238',
      sidebar: '#0d1d52',
      sidebarBorder: '#1a2c66',
      sidebarMuted: '#b8c6eb',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f8faff',
      surfaceMuted: '#eef3ff',
    },
  },
  {
    categories: ['Institucional', 'Campanha', 'Evento', 'Comunicado'],
    id: 'tonante',
    name: 'TONANTE',
    theme: {
      bg: '#ffffff',
      border: '#d6d6d6',
      borderStrong: '#bfbfbf',
      ink: '#111111',
      muted: '#5e5e5e',
      primary: '#111111',
      primarySoft: '#f0f0f0',
      primaryStrong: '#000000',
      sidebar: '#000000',
      sidebarBorder: '#191919',
      sidebarMuted: '#bdbdbd',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f7f7f7',
      surfaceMuted: '#f0f0f0',
    },
  },
  {
    categories: ['Institucional', 'Promoção', 'Lançamento', 'Relacionamento'],
    id: 'quati',
    name: 'QUATI',
    theme: {
      bg: '#f8fbf1',
      border: '#dce8c8',
      borderStrong: '#cadcaf',
      ink: '#24310f',
      muted: '#66724b',
      primary: '#7fc21f',
      primarySoft: '#edf8d6',
      primaryStrong: '#5e9612',
      sidebar: '#6ba319',
      sidebarBorder: '#79b81d',
      sidebarMuted: '#d6edaf',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#fbfdf7',
      surfaceMuted: '#f2f8e7',
    },
  },
  {
    categories: ['Institucional', 'Comercial', 'Promocional', 'Suporte'],
    id: 'skul',
    name: 'SKUL',
    theme: {
      bg: '#f4f2f6',
      border: '#e1d9e6',
      borderStrong: '#cdbfd8',
      ink: '#2a1b33',
      muted: '#6c5b78',
      primary: '#59008e',
      primarySoft: '#efe6f6',
      primaryStrong: '#3c0061',
      sidebar: '#2f0a46',
      sidebarBorder: '#3d1254',
      sidebarMuted: '#bda7cb',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f8f4fb',
      surfaceMuted: '#eee7f3',
    },
  },
  {
    categories: ['Institucional', 'Comercial', 'Promocional', 'Suporte'],
    id: 'vinik',
    name: 'VINIK',
    theme: {
      bg: '#f2faf7',
      border: '#d7ede6',
      borderStrong: '#b7ddd2',
      ink: '#0c2a22',
      muted: '#4c6f64',
      primary: '#00b980',
      primarySoft: '#e5f8f1',
      primaryStrong: '#00845b',
      sidebar: '#004c3b',
      sidebarBorder: '#0b5f4b',
      sidebarMuted: '#a7d5c6',
      sidebarText: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f6fcfa',
      surfaceMuted: '#ecf7f3',
    },
  },
]

export const companyThemeStyle = (theme: CompanyTheme) =>
  ({
    '--bg': theme.bg,
    '--border': theme.border,
    '--border-strong': theme.borderStrong,
    '--ink': theme.ink,
    '--muted': theme.muted,
    '--primary': theme.primary,
    '--primary-soft': theme.primarySoft,
    '--primary-strong': theme.primaryStrong,
    '--sidebar': theme.sidebar,
    '--sidebar-border': theme.sidebarBorder,
    '--sidebar-muted': theme.sidebarMuted,
    '--sidebar-text': theme.sidebarText,
    '--surface': theme.surface,
    '--surface-alt': theme.surfaceAlt,
    '--surface-muted': theme.surfaceMuted,
  }) as CSSProperties
