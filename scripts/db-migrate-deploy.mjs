// Build-time migration step. `prisma migrate deploy` needs the direct (non-
// pooler) connection (DIRECT_URL). When it is not configured — e.g. a preview
// build or a fresh environment — we skip loudly instead of failing the build;
// the app then runs against whatever schema the database already has.
import { spawnSync } from 'node:child_process'

if (!process.env.DIRECT_URL) {
  console.warn(
    '[db-migrate-deploy] DIRECT_URL is not set — skipping `prisma migrate deploy`. ' +
      'Set DIRECT_URL (Neon direct endpoint) so schema changes ship with the build.',
  )
  process.exit(0)
}
const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
