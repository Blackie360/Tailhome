CREATE TABLE IF NOT EXISTS "download_events" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "asset" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "download_events_asset_created_at_idx"
  ON "download_events" ("asset", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "publish_download_stats" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "site_settings_singleton" CHECK (id = 1)
);

INSERT INTO "site_settings" ("id", "publish_download_stats")
VALUES (1, false)
ON CONFLICT ("id") DO NOTHING;
