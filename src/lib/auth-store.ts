import type { Session, Subscription } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from './supabase'
import type { ProfileRecord } from '../types/profile'

type ProfileRow = {
  email: string
  full_name: string
  id: string
}

function mapProfile(row: ProfileRow): ProfileRecord {
  return {
    email: row.email,
    fullName: row.full_name,
    id: row.id,
  }
}

export async function getCurrentSession() {
  const client = getSupabaseBrowserClient()

  const result = await client.auth.getSession()
  if (result.error) {
    throw result.error
  }

  return result.data.session
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

  const result = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (result.error) {
    throw result.error
  }

  return result.data.session
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  const client = getSupabaseBrowserClient()

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
}

export async function signOutCurrentUser() {
  const client = getSupabaseBrowserClient()

  const result = await client.auth.signOut()
  if (result.error) {
    throw result.error
  }
}

export async function updateCurrentUserPassword(password: string) {
  const client = getSupabaseBrowserClient()

  const result = await client.auth.updateUser({
    password,
  })

  if (result.error) {
    throw result.error
  }
}

export async function loadCurrentProfile(userId: string) {
  const client = getSupabaseBrowserClient()

  const result = await client.from('profiles').select('id, email, full_name').eq('id', userId).maybeSingle()
  if (result.error) {
    throw result.error
  }

  return result.data ? mapProfile(result.data as ProfileRow) : null
}
