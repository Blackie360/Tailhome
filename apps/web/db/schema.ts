import { bigint, boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const downloadEvents = pgTable("download_events", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
  asset: text("asset").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
})

export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey().default(1),
  publishDownloadStats: boolean("publish_download_stats").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
})
