# Deployment Notes

## Supabase

- Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Do not place the Supabase `service_role` key in Vite env files or in the repository.
- Run the starter schema in `supabase/schema.sql` after auth and RLS policy decisions are defined.

## Vercel via GitHub Actions

Set these repository secrets before enabling the workflow:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow in `.github/workflows/vercel-production.yml` follows the current Vercel CLI flow:

1. `vercel pull`
2. `vercel build --prod`
3. `vercel deploy --prebuilt --prod`
