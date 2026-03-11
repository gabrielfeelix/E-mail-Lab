import type { Session, Subscription } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './supabase'
import type { ProfileRecord } from '../types/profile'

type ProfileRow = {
  email: string
  full_name: string
  id: string
  is_admin: boolean
}

type MembershipRow = {
  company_id: string
}

function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    isAdmin: Boolean(row.is_admin),
  }
}

function normalizeAuthError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim().toLowerCase()

    if (message === 'failed to fetch' || message.includes('network') || message.includes('fetch')) {
      return new Error(
        'Nao foi possivel conectar ao servico de login. O Supabase Auth pode estar indisponivel no momento.'
      )
    }

    return error
  }

  return new Error('Nao foi possivel concluir a autenticacao.')
}

export async function getCurrentSession() {
  const client = getSupabaseBrowserClient()

  try {
    const result = await client.auth.getSession()
    if (result.error) {
      throw result.error
    }

    return result.data.session
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export function subscribeToAuth(callback: (session: Session | null) => void): Subscription | null {
  const client = getSupabaseBrowserClient()

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })

  return data.subscription
}

export async function signInWithPassword(email: string, password: string) {
  const client = getSupabaseBrowserClient()

  try {
    const result = await client.auth.signInWithPassword({
      email,
      password,
    })

    if (result.error) {
      throw result.error
    }

    return result.data.session
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  const client = getSupabaseBrowserClient()

  try {
    const result = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (result.error) {
      throw result.error
    }

    return result.data.session
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function signOutCurrentUser() {
  const client = getSupabaseBrowserClient()

  try {
    const result = await client.auth.signOut()
    if (result.error) {
      throw result.error
    }
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function updateCurrentUserPassword(password: string) {
  const client = getSupabaseBrowserClient()

  try {
    const result = await client.auth.updateUser({
      password,
    })

    if (result.error) {
      throw result.error
    }
  } catch (error) {
    throw normalizeAuthError(error)
  }
}

export async function loadCurrentProfile(userId: string) {
  const client = getSupabaseBrowserClient()

  const result = await client.from('profiles').select('id, email, full_name, is_admin').eq('id', userId).maybeSingle()
  if (result.error) {
    throw result.error
  }

  return result.data ? mapProfile(result.data as ProfileRow) : null
}

export async function loadCurrentMembershipCompanyIds() {
  const client = getSupabaseBrowserClient()

  const result = await client.from('company_memberships').select('company_id')
  if (result.error) {
    throw result.error
  }

  return (result.data ?? []).map((row) => String((row as MembershipRow).company_id))
}
