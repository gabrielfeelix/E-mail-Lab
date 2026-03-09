import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const schemaPath = resolve(process.cwd(), 'supabase/schema.sql')
const projectRef = process.env.SUPABASE_PROJECT_REF || 'mejsihwvvpcmiktnnnpx'
const accessToken = process.env.SUPABASE_ACCESS_TOKEN

if (!accessToken) {
  console.error('Missing SUPABASE_ACCESS_TOKEN. Create a Supabase personal access token to run remote SQL.')
  process.exit(1)
}

const query = await readFile(schemaPath, 'utf8')

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
    }),
  },
)

if (!response.ok) {
  const body = await response.text()
  console.error(body)
  process.exit(1)
}

const result = await response.json()
console.log(JSON.stringify(result, null, 2))
