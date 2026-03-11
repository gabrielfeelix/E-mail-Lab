# Deployment Notes

## Supabase

- Frontend uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Serverless routes may use `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` and fall back to the `VITE_` names when needed.
- Do not place the Supabase `service_role` key in Vite env files or in the repository.
- Remote DDL is not available with `publishable` or `service_role` in the browser. To apply `supabase/schema.sql`, use `SUPABASE_ACCESS_TOKEN` with `npm run db:apply`.
- `SUPABASE_PROJECT_REF` defaults to `mejsihwvvpcmiktjnnpx` in the helper script.
- Production on Vercel must define `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Without them, the browser app cannot authenticate.

## Vercel via GitHub Actions

Set these repository secrets before enabling the workflow:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The workflow in `.github/workflows/vercel-production.yml` follows the current Vercel CLI flow:

1. `vercel pull`
2. `vercel build --prod`
3. `vercel deploy --prebuilt --prod`
