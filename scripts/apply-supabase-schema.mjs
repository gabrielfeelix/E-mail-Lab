import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const schemaPath = resolve(process.cwd(), 'supabase/schema.sql')
const defaultProjectRef = 'mejsihwvvpcmiktjnnpx'

async function readEnvFile(filename) {
  try {
    const content = await readFile(resolve(process.cwd(), filename), 'utf8')
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separatorIndex = line.indexOf('=')
          const key = line.slice(0, separatorIndex).trim()
          const value = line.slice(separatorIndex + 1).trim()
          return [key, value]
        }),
    )
  } catch {
    return {}
  }
}

const [localEnv, rootEnv] = await Promise.all([readEnvFile('.env.local'), readEnvFile('.env')])
const projectRef =
  process.env.SUPABASE_PROJECT_REF ||
  localEnv.SUPABASE_PROJECT_REF ||
  rootEnv.SUPABASE_PROJECT_REF ||
  defaultProjectRef
const accessToken =
  process.env.SUPABASE_ACCESS_TOKEN ||
  localEnv.SUPABASE_ACCESS_TOKEN ||
  rootEnv.SUPABASE_ACCESS_TOKEN

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
