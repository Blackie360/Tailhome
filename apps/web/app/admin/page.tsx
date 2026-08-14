import { loginAdmin, logoutAdmin, updatePublishStats } from "@/app/admin/actions"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { getDownloadStats } from "@/lib/downloads"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false
  }
}

export default async function AdminPage({
  searchParams
}: {
  searchParams?: { error?: string }
}) {
  const authenticated = await isAdminAuthenticated()

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#0f1412] px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">Hidden</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">TailHome admin</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to view download counts and choose whether they appear on the landing page.
          </p>
          {searchParams?.error ? (
            <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Incorrect password.
            </p>
          ) : null}
          <form action={loginAdmin} className="mt-8 space-y-4">
            <label className="block text-sm text-slate-300">
              Password
              <input
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none ring-emerald-300/40 focus:ring"
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            <Button className="h-11 w-full rounded-full bg-emerald-300 font-bold text-slate-950 hover:bg-emerald-200" type="submit">
              Unlock
            </Button>
          </form>
        </div>
      </main>
    )
  }

  const stats = await getDownloadStats()

  return (
    <main className="min-h-screen bg-[#0f1412] px-6 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/80">Hidden</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Download analytics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Counts come from `/install.sh`, `/install.ps1`, and `/downloads/*` requests. Publish installer totals to the public landing page when you want them visible.
            </p>
          </div>
          <form action={logoutAdmin}>
            <Button className="rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10" type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>

        {!stats ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6 text-amber-100">
            `DATABASE_URL` is not configured, so stats cannot load yet.
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Installer hits" value={stats.installerDownloads} hint="install.sh + install.ps1" />
              <StatCard label="Bundle downloads" value={stats.bundleDownloads} hint="platform archives" />
              <StatCard label="All tracked" value={stats.totalDownloads} hint="installers + bundles" />
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Landing page visibility</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {stats.publishDownloadStats
                      ? "Installer hit count is currently public on the homepage."
                      : "Installer hit count is hidden from the homepage."}
                  </p>
                </div>
                <form action={updatePublishStats}>
                  <input type="hidden" name="publish" value={stats.publishDownloadStats ? "0" : "1"} />
                  <Button className="rounded-full bg-emerald-300 font-bold text-slate-950 hover:bg-emerald-200" type="submit">
                    {stats.publishDownloadStats ? "Unpublish" : "Publish on landing page"}
                  </Button>
                </form>
              </div>
            </section>

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 px-6 py-4">
                <h2 className="text-xl font-semibold">By asset</h2>
              </div>
              <div className="divide-y divide-white/10">
                {stats.byAsset.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-slate-400">No downloads recorded yet.</p>
                ) : (
                  stats.byAsset.map((row) => (
                    <div key={row.asset} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                      <code className="text-emerald-200">{row.asset}</code>
                      <span className="font-semibold tabular-nums text-white">{row.count.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums text-white">{value.toLocaleString()}</p>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
    </div>
  )
}
