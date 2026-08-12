import type { Metadata } from "next";
import { ArrowLeft, Download, Github, TerminalSquare } from "lucide-react";
import { readInstallerSource } from "@/lib/installer-source";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Installer source",
  description: "Read the TailHome shell installer before running it."
};

export default async function InstallerSourcePage() {
  const installerSource = await readInstallerSource();

  return (
    <main className="min-h-screen bg-[#f5f7f3]">
      <section className="grid-field relative overflow-hidden bg-[#07120f] text-white">
        <div className="hero-glow" />
        <header className="container relative z-10 flex h-20 items-center justify-between">
          <Logo />
          <a
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/75 transition hover:border-emerald-300/40 hover:text-emerald-200"
            href="/#install"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to install
          </a>
        </header>

        <div className="container relative z-10 pb-16 pt-12 sm:pb-24 sm:pt-20">
          <p className="eyebrow eyebrow-dark">Installer source</p>
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <h1 className="section-title max-w-3xl text-white">
                Read the script before it touches your server.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
                This page renders the same <code>/install.sh</code> file the site serves for the
                TailHome install command, so you can inspect it without Chrome treating the
                shell script as a download.
              </p>
            </div>
            <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-slate-300 shadow-surface">
              <p className="font-display text-lg font-bold text-white">Install URL unchanged</p>
              <p className="mt-3">
                The runnable endpoint remains <code>https://tailhome.blackielabs.com/install.sh</code>.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-200"
                  href="/install.sh"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Raw install.sh
                </a>
                <a
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-white/80 hover:text-white"
                  href="https://github.com/Blackie360/Tailhome"
                >
                  <Github className="size-4" aria-hidden="true" />
                  GitHub
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="container py-10 sm:py-14">
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-surface">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-rose-400" />
              <span className="size-2.5 rounded-full bg-amber-300" />
              <span className="size-2.5 rounded-full bg-emerald-300" />
            </div>
            <p className="font-mono text-xs text-white/45">public/install.sh</p>
            <div className="w-14" />
          </div>
          <pre className="max-h-[72vh] overflow-auto p-5 text-sm leading-6 text-lime-100 sm:p-7">
            <code>{installerSource}</code>
          </pre>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <a className="group flex items-center gap-3" href="/" aria-label="TailHome home">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path
            d="M7 19.5 20 8l13 11.5V32a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V19.5Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M14 34V23h12v11M11 16.5h18" stroke="currentColor" strokeWidth="2" />
          <circle cx="20" cy="18" r="2.5" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white">
        Tail<span className="text-emerald-300">Home</span>
      </span>
    </a>
  );
}
