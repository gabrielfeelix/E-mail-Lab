import type { TemplateVariableGroup } from '../data/template-variables'
import { getSupabaseBrowserClient } from './supabase'

type TemplateVariableRow = {
  created_at: string
  group_id: string
  group_label: string
  id: string
  label: string
  sort_order: number
  token: string
  updated_at: string
}

function groupVariableRows(rows: TemplateVariableRow[]) {
  const grouped = new Map<string, TemplateVariableGroup>()

  rows
    .slice()
    .sort((left, right) => {
      if (left.group_label !== right.group_label) {
        return left.group_label.localeCompare(right.group_label)
      }

      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order
      }

      return left.label.localeCompare(right.label)
    })
    .forEach((row) => {
      const existing = grouped.get(row.group_id)

      if (existing) {
        existing.variables.push({
          id: row.id,
          label: row.label,
          token: row.token,
        })
        return
      }

      grouped.set(row.group_id, {
        id: row.group_id,
        label: row.group_label,
        variables: [
          {
            id: row.id,
            label: row.label,
            token: row.token,
          },
        ],
      })
    })

  return Array.from(grouped.values())
}

export async function loadRemoteTemplateVariables() {
  const client = getSupabaseBrowserClient()
  const result = await client
    .from('template_variables')
    .select('id, group_id, group_label, label, token, sort_order, created_at, updated_at')
    .order('group_label', { ascending: true })
    .order('sort_order', { ascending: true })

  if (result.error) {
    throw result.error
  }

  return groupVariableRows((result.data ?? []) as TemplateVariableRow[])
}
