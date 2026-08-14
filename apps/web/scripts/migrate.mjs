import { config } from "dotenv"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { neon } from "@neondatabase/serverless"

config({ path: ".env.local" })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is required (set it in apps/web/.env.local)")
  process.exit(1)
}

const sql = neon(databaseUrl)
const root = dirname(fileURLToPath(import.meta.url))
const drizzleDir = join(root, "..", "drizzle")
const migrations = readdirSync(drizzleDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()

await sql`
  CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`

for (const file of migrations) {
  const tag = file.replace(/\.sql$/, "")
  const existing = await sql`
    SELECT 1 AS present
    FROM "__drizzle_migrations"
    WHERE hash = ${tag}
    LIMIT 1
  `
  if (existing.length > 0) {
    console.log(`skip  ${file} (already applied)`)
    continue
  }

  const migrationSql = readFileSync(join(drizzleDir, file), "utf8")
  console.log(`apply ${file}`)

  // neon serverless HTTP does not support multi-statement transactions the same way;
  // split on semicolons while keeping statements intact.
  const statements = migrationSql
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  for (const statement of statements) {
    await sql.query(statement.endsWith(";") ? statement : `${statement};`)
  }

  await sql`
    INSERT INTO "__drizzle_migrations" (hash, created_at)
    VALUES (${tag}, ${Date.now()})
  `
}

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`

console.log("Neon migration complete.")
console.log("Tables:", tables.map((row) => row.table_name).join(", "))
