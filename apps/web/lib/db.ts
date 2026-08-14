import { neon } from "@neondatabase/serverless"

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return null
  }
  return neon(databaseUrl)
}
