import { getSql } from "@/lib/db"
import { downloadAssetFromPath } from "@/lib/download-asset.mjs"

export { downloadAssetFromPath }

const INSTALLER_ASSETS = new Set(["install.sh", "install.ps1"])

export async function recordDownload(asset: string): Promise<void> {
  const sql = getSql()
  if (!sql) {
    return
  }

  try {
    await sql`INSERT INTO download_events (asset) VALUES (${asset})`
  } catch (error) {
    console.error("Failed to record download", error)
  }
}

export type DownloadStats = {
  installerDownloads: number
  bundleDownloads: number
  totalDownloads: number
  byAsset: Array<{ asset: string; count: number }>
  publishDownloadStats: boolean
}

export async function getDownloadStats(): Promise<DownloadStats | null> {
  const sql = getSql()
  if (!sql) {
    return null
  }

  try {
    const [rows, settings] = await Promise.all([
      sql`SELECT asset, COUNT(*)::int AS count
          FROM download_events
          GROUP BY asset
          ORDER BY count DESC, asset ASC`,
      sql`SELECT publish_download_stats
          FROM site_settings
          WHERE id = 1`
    ])

    const byAsset = rows.map((row) => ({
      asset: String(row.asset),
      count: Number(row.count) || 0
    }))

    let installerDownloads = 0
    let bundleDownloads = 0
    for (const row of byAsset) {
      if (INSTALLER_ASSETS.has(row.asset)) {
        installerDownloads += row.count
      } else {
        bundleDownloads += row.count
      }
    }

    return {
      installerDownloads,
      bundleDownloads,
      totalDownloads: installerDownloads + bundleDownloads,
      byAsset,
      publishDownloadStats: Boolean(settings[0]?.publish_download_stats)
    }
  } catch (error) {
    console.error("Failed to load download stats", error)
    return null
  }
}

export async function getPublicInstallCount(): Promise<number | null> {
  const sql = getSql()
  if (!sql) {
    return null
  }

  try {
    const [settings] = await sql`SELECT publish_download_stats FROM site_settings WHERE id = 1`
    if (!settings?.publish_download_stats) {
      return null
    }

    const [row] = await sql`
      SELECT COUNT(*)::int AS count
      FROM download_events
      WHERE asset IN ('install.sh', 'install.ps1')
    `
    return Number(row?.count) || 0
  } catch (error) {
    console.error("Failed to load public install count", error)
    return null
  }
}

export async function setPublishDownloadStats(publish: boolean): Promise<void> {
  const sql = getSql()
  if (!sql) {
    throw new Error("DATABASE_URL is not configured")
  }
  await sql`
    UPDATE site_settings
    SET publish_download_stats = ${publish}, updated_at = now()
    WHERE id = 1
  `
}
