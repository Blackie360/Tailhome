import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Archive,
  Check,
  ChevronRight,
  Cpu,
  Github,
  HardDrive,
  KeyRound,
  Network,
  TerminalSquare,
  UserRound
} from "lucide-react";
import { CommandBuilder } from "@/components/command-builder";
import { HeroCommand } from "@/components/hero-command";
import { InstallationVideo } from "@/components/installation-video";
import { Logo } from "@/components/logo";
import { NetworkHero } from "@/components/network-hero";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getPublicInstallCount } from "@/lib/downloads";

const services = [
  { name: "Homepage", port: "3000", color: "mint", profile: false },
  { name: "Caddy", port: "8088", color: "blue", profile: false },
  { name: "Grafana", port: "3001", color: "violet", profile: true },
  { name: "Prometheus", port: "9090", color: "coral", profile: true },
  { name: "Node Exporter", port: "9100", color: "mint", profile: true },
  { name: "Uptime Kuma", port: "3002", color: "cyan", profile: true },
  { name: "Portainer", port: "9443", color: "pink", profile: true },
  { name: "Pi-hole", port: "8080", color: "blue", profile: true }
];

const commands = [
  ["status", "See every container at a glance"],
  ["urls", "Open private service endpoints"],
  ["update", "Pull, restart, and keep moving"],
  ["backup", "Archive the complete install"],
  ["uninstall", "Remove the stack, files, and CLI"]
];

const steps = [
  { number: "01", title: "Install", body: "Run one inspectable shell command on a supported Linux host." },
  { number: "02", title: "Connect", body: "Sign in to Tailscale and add the host to your private tailnet." },
  { number: "03", title: "Operate", body: "Use the tailhome CLI to check, update, and back up the stack." }
];

const stackFacts = [
  "Dashboard and gateway stay core",
  "Monitoring, uptime, Portainer, and Pi-hole start on",
  "Access stays inside your tailnet"
];

export default async function Home() {
  const publicInstallCount = await getPublicInstallCount();

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <SiteHeader />
      <main className="overflow-hidden" id="content">
        <section className="hero-shell grid-field" id="top">
          <div className="container relative z-10 grid min-h-[760px] items-center gap-14 pb-24 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:pb-32 lg:pt-20">
            <div className="max-w-2xl entrance-copy">
              <p className="eyebrow eyebrow-dark"><span className="status-dot" /> Your cloud. At home.</p>
              <h1 className="display-title mt-6 text-white">A private cloud<br /><span className="text-gradient">that feels effortless.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
                One command turns your home server into a secure, observable service stack—available anywhere on your Tailscale network.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-full bg-emerald-300 px-6 font-bold text-slate-950 hover:bg-emerald-200">
                  <a href="#install">Copy the install command <ArrowRight className="size-4" /></a>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
                  <a href="#walkthrough">See the walkthrough</a>
                </Button>
              </div>
              <HeroCommand />
              <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" /> No port forwarding</span>
                <span className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" /> No subscription</span>
                <span className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" /> MIT licensed</span>
                {publicInstallCount !== null ? (
                  <span className="flex items-center gap-2">
                    <Check className="size-3.5 text-emerald-300" />
                    {publicInstallCount.toLocaleString()} installs tracked
                  </span>
                ) : null}
              </div>
            </div>

            <NetworkHero />
          </div>
          <div className="container relative z-10 -mt-12 pb-12 lg:-mt-20">
            <div className="step-rail" aria-label="How TailHome works in three steps">
              {steps.map((step) => (
                <article className="step-card" key={step.number}>
                  <span>{step.number}</span>
                  <div>
                    <p className="step-card-title">{step.title}</p>
                    <p>{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="hero-glow" />
        </section>

        <section className="bg-[#edf2ed] py-20 sm:py-24" id="walkthrough">
          <div className="container section-reveal">
            <div className="grid items-end gap-7 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <p className="eyebrow">Installation walkthrough</p>
                <h2 className="section-title mt-5">See the whole setup<br />before you run it.</h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
                Follow the real TailHome path from the hosted command and interactive choices to a healthy private service dashboard.
              </p>
            </div>
            <div className="mt-12 sm:mt-14">
              <InstallationVideo />
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24" id="install">
          <div className="container section-reveal">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="eyebrow justify-center">Start building</p>
              <h2 className="section-title mt-5">Copy one command. Run it on Linux.</h2>
              <p className="mt-5 text-lg text-muted-foreground">The default install is the complete TailHome stack. macOS and Windows get the CLI; service profiles stay available after install when you want a lighter host.</p>
            </div>
            <div className="installer-wrap"><CommandBuilder /></div>
            <div className="install-ledger mt-10">
              <div className="install-ledger-head">
                <div><span>Installation ledger</span><strong>Everything the command changes, in the open.</strong></div>
                <span className="install-ledger-count">03 checks</span>
              </div>
              <div className="install-ledger-items">
                <InstallLedgerItem number="01" icon={HardDrive} title="Deploy" body="Checks ports, installs dependencies when needed, creates the Compose stack, and starts the enabled services." />
                <InstallLedgerItem number="02" icon={Archive} title="Store" body="Keeps Compose files, configuration, and environment values together in /opt/tailhome; the CLI lives in /usr/local/bin." />
                <InstallLedgerItem number="03" icon={KeyRound} title="Protect" body="Generates credentials for Grafana and Pi-hole when those services are enabled, and hides secrets when the CLI prints environment values." />
              </div>
              <div className="install-platform-strip">
                <span>Full stack host <strong>Raspberry Pi OS · Debian · Ubuntu · Linux ARM</strong></span>
                <span>Remote CLI <strong>macOS · Windows</strong></span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f7f3] py-20 sm:py-24" id="how-it-works">
          <div className="container section-reveal grid items-center gap-14 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="eyebrow">The private path</p>
              <h2 className="section-title mt-5">Reach home.<br />Never expose it.</h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">Your device reaches TailHome through Tailscale’s encrypted mesh. The host stays yours, and services remain on your hardware instead of moving into someone else’s cloud.</p>
              <div className="mt-8 rounded-2xl border bg-white p-5 text-sm leading-6 text-muted-foreground">
                <strong className="text-foreground">No port forwarding required.</strong> Access is governed by membership and policy in your tailnet. TailHome does expose ports on the host, so keep your firewall rules limited to trusted networks.
              </div>
            </div>
            <ArchitectureDiagram />
          </div>
        </section>

        <section className="relative bg-white py-20 sm:py-24" id="stack">
          <div className="container section-reveal">
            <div className="grid items-end gap-8 lg:grid-cols-2">
              <div>
                <p className="eyebrow">Everything connected</p>
                <h2 className="section-title mt-5">Your essential services,<br />already talking.</h2>
              </div>
              <p className="max-w-xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
                Install the full current TailHome stack by default: dashboard, gateway, monitoring, uptime, container management, and DNS. Compose profiles stay available when you want to opt out of a group.
              </p>
            </div>

            <div className="service-stage mt-16">
              <div className="service-list">
                {services.map((service, index) => (
                  <div className="service-row" key={service.name}>
                    <span className={`service-icon service-icon-${service.color}`}>{service.name.slice(0, 1)}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-bold">{service.name}</h3>
                      <p className="text-sm text-muted-foreground">tailhome:{service.port}</p>
                    </div>
                    <span className="live-pill"><span /> {service.profile ? "profile" : "core"}</span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:block">0{index + 1}</span>
                  </div>
                ))}
              </div>
              <aside className="observability-panel">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-widest text-white/50">Default install</p>
                  <span className="live-pill dark"><span /> 8 services</span>
                </div>
                <p className="mt-8 font-display text-3xl font-bold tracking-tight text-white">What the command enables.</p>
                <p className="mt-3 text-sm leading-6 text-white/60">Not live telemetry. Homepage, Caddy, and four profiles start on your host unless you opt out.</p>
                <ul className="stack-facts">
                  {stackFacts.map((fact) => <li key={fact}>{fact}</li>)}
                </ul>
                <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                  <MiniMetric value="2" label="core services" />
                  <MiniMetric value="4" label="profile groups" />
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="bg-[#f5f7f3] py-20 sm:py-24" id="cli">
          <div className="container section-reveal grid items-center gap-14 lg:grid-cols-[0.78fr_1.22fr]">
            <div>
              <p className="eyebrow">One calm interface</p>
              <h2 className="section-title mt-5">Control the whole house from one command.</h2>
              <p className="mt-6 text-lg leading-8 text-muted-foreground">A small, fast Go CLI handles the everyday work. Human-readable output, predictable commands, zero dashboard hunting.</p>
              <div className="mt-9 divide-y divide-border border-y">
                {commands.map(([command, detail]) => (
                  <div className="flex items-center gap-4 py-4" key={command}>
                    <ChevronRight className="size-4 shrink-0 text-primary" />
                    <code className="w-28 shrink-0 font-bold text-foreground">{command}</code>
                    <span className="text-sm text-muted-foreground">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
            <TerminalPreview />
          </div>
        </section>

        <section className="relative bg-[#07120f] py-20 text-white sm:py-24" id="security">
          <div className="absolute inset-0 grid-field opacity-40" />
          <div className="container section-reveal relative grid gap-16 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="eyebrow eyebrow-dark">Proof, not promises</p>
              <h2 className="section-title mt-5 text-white">Infrastructure you can inspect and own.</h2>
              <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">TailHome keeps the machinery visible: Compose files you can reproduce, commands you can read, and backups you control.</p>
              <a className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200" href="https://github.com/Blackie360/Tailhome">Inspect the source <ArrowRight className="size-4" /></a>
            </div>
            <div className="principles-list">
              <Principle icon={Github} number="01" title="Open source" body="The installer and CLI are published under the MIT License." />
              <Principle icon={HardDrive} number="02" title="Self-hosted" body="Services and their data run on hardware you control." />
              <Principle icon={KeyRound} number="03" title="Generated passwords" body="Service credentials are created at install, not shipped as shared defaults." />
              <Principle icon={Archive} number="04" title="Portable backups" body="tailhome backup archives the complete install directory with a timestamp." />
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24" id="faq">
          <div className="container section-reveal grid gap-14 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="eyebrow">Questions, answered</p>
              <h2 className="section-title mt-5">Clear before you commit.</h2>
              <p className="mt-6 text-muted-foreground">From a first Raspberry Pi to an established home server, the same configuration remains readable and yours.</p>
            </div>
            <div className="faq-list">
              <Faq question="What can I use TailHome for?">Run a private dashboard, monitoring, uptime checks, DNS filtering, container management, and reverse-proxy shortcuts for your household or homelab.</Faq>
              <Faq question="Does it open my server to the internet?">TailHome does not require router port forwarding. Services bind on the host, so use Tailscale and appropriate firewall rules to restrict who can reach them.</Faq>
              <Faq question="Can I see or change the configuration?">Yes. The generated Docker Compose and service configuration live under /opt/tailhome by default, making the install inspectable and reproducible.</Faq>
              <Faq question="How do updates and backups work?">Use tailhome update to pull and restart services, and tailhome backup to create a timestamped archive of the complete TailHome directory.</Faq>
              <Faq question="How do I uninstall?">Run <code>tailhome uninstall --yes</code>. That stops the Compose stack and volumes, removes /opt/tailhome, the CLI binary, and TailHome’s Tailscale systemd drop-in. Docker and Tailscale stay installed.</Faq>
              <Faq question="Where is the documentation?"><a className="font-bold text-primary hover:underline" href="https://github.com/Blackie360/Tailhome/blob/main/apps/tailhome/README.md">Read the install, command, service, and security guide on GitHub ↗</a></Faq>
            </div>
          </div>
        </section>

        <section className="bg-emerald-300 py-20">
          <div className="container flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-emerald-950/60">Your cloud starts at home</p>
              <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Ready to make your server yours?</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-full bg-slate-950 px-6 font-bold text-white hover:bg-slate-800">
                <a href="#install">Copy the install command <ArrowRight className="size-4" /></a>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full border-slate-950/20 bg-transparent px-6 font-bold text-slate-950 hover:bg-white/40">
                <a href="https://github.com/Blackie360/Tailhome"><Github className="size-4" /> View on GitHub</a>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container flex flex-col gap-6 border-t border-white/10 py-8 sm:flex-row sm:items-center sm:justify-between">
          <Logo />
          <p className="text-sm text-white/40">Private infrastructure for the places that matter.</p>
          <a className="text-sm text-white/60 hover:text-white" href="https://github.com/Blackie360/Tailhome">Open source on GitHub ↗</a>
        </div>
      </footer>
    </>
  );
}

function ArchitectureDiagram() {
  return (
    <figure className="architecture" aria-label="Your device connects through a Tailscale network to a TailHome host and its private services">
      <div className="architecture-flow">
        <ArchitectureNode icon={UserRound} eyebrow="You" title="Phone or laptop" />
        <span className="architecture-link"><i /> encrypted</span>
        <ArchitectureNode icon={Network} eyebrow="Your tailnet" title="Tailscale mesh" featured />
        <span className="architecture-link"><i /> private</span>
        <ArchitectureNode icon={Cpu} eyebrow="Your hardware" title="TailHome host" />
      </div>
      <div className="architecture-services">
        <span>Homepage · core</span>
        <span>Caddy · core</span>
        <span>Monitoring · profile</span>
        <span>DNS · profile</span>
      </div>
      <figcaption>Identity-aware access in. Private Docker services behind your TailHome host.</figcaption>
    </figure>
  );
}

function ArchitectureNode({ icon: Icon, eyebrow, title, featured = false }: { icon: LucideIcon; eyebrow: string; title: string; featured?: boolean }) {
  return (
    <div className={`architecture-node ${featured ? "featured" : ""}`}>
      <Icon aria-hidden="true" />
      <span>{eyebrow}</span>
      <strong>{title}</strong>
    </div>
  );
}

function InstallLedgerItem({ icon: Icon, number, title, body }: { icon: LucideIcon; number: string; title: string; body: string }) {
  return (
    <article className="install-ledger-item">
      <span className="install-ledger-number">{number}</span>
      <Icon aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  );
}

function Faq({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="faq-item">
      <summary>{question}<span aria-hidden="true">+</span></summary>
      <div>{children}</div>
    </details>
  );
}

function TerminalPreview() {
  return (
    <div className="terminal-window surface-glow">
      <div className="terminal-bar">
        <div className="flex gap-2"><span /><span /><span /></div>
        <p>tailhome — status</p>
        <div />
      </div>
      <div className="terminal-body">
        <p className="text-white/40">$ <span className="text-white">tailhome status</span></p>
        <div className="mt-8 flex items-center gap-3">
          <LogoMarkSmall />
          <div>
            <strong className="font-display text-xl text-white">TailHome</strong>
            <p className="text-xs text-white/40">home server control plane</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-4 border-t border-white/10 pt-6 text-sm">
          <span className="text-white/40">SERVICE</span>
          <span className="text-white/40">PORT</span>
          <span className="text-white/40">STATE</span>
          {[["homepage", "3000"], ["caddy", "8088"], ["grafana", "3001"], ["uptime-kuma", "3002"], ["pihole", "8080"]].map(([name, port]) => (
            <TerminalRow key={name} name={name} port={port} />
          ))}
        </div>
        <p className="mt-7 text-emerald-300">✓ default stack healthy <span className="text-white/30">in 18ms</span></p>
      </div>
    </div>
  );
}

function TerminalRow({ name, port }: { name: string; port: string }) {
  return (
    <>
      <span className="text-slate-200">{name}</span>
      <span className="text-white/50">:{port}</span>
      <span className="text-emerald-300">● running</span>
    </>
  );
}

function LogoMarkSmall() {
  return (
    <span className="grid size-11 place-items-center rounded-xl bg-emerald-300 text-slate-950">
      <TerminalSquare className="size-5" aria-hidden="true" />
    </span>
  );
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong className="font-display text-2xl text-white">{value}</strong>
      <p className="mt-1 text-xs uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

function Principle({ icon: Icon, number, title, body }: { icon: LucideIcon; number: string; title: string; body: string }) {
  return (
    <article className="principle">
      <span className="principle-number">{number}</span>
      <Icon className="size-5 text-emerald-300" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{body}</p>
    </article>
  );
}
