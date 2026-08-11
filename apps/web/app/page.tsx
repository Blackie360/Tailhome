import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Archive,
  Check,
  ChevronRight,
  Cloud,
  Cpu,
  Github,
  Globe2,
  HardDrive,
  KeyRound,
  Laptop,
  Network,
  TerminalSquare,
  UserRound,
} from "lucide-react";
import { CommandBuilder } from "@/components/command-builder";
import { Button } from "@/components/ui/button";

const services = [
  { name: "Homepage", port: "3000", color: "mint" },
  { name: "Grafana", port: "3001", color: "violet" },
  { name: "Prometheus", port: "9090", color: "coral" },
  { name: "Uptime Kuma", port: "3002", color: "cyan" },
  { name: "Portainer", port: "9443", color: "blue" },
  { name: "Pi-hole", port: "8080", color: "pink" }
];

const commands = [
  ["status", "See every container at a glance"],
  ["urls", "Open private service endpoints"],
  ["update", "Pull, restart, and keep moving"],
  ["backup", "Archive the complete install"]
];

const steps = [
  { number: "01", title: "Install", body: "Run one inspectable shell command on a supported Linux host." },
  { number: "02", title: "Connect", body: "Sign in to Tailscale and add the host to your private tailnet." },
  { number: "03", title: "Operate", body: "Use the tailhome CLI to check, update, and back up the stack." }
];

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="hero-shell grid-field" id="top">
        <header className="container relative z-20 flex h-20 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex" aria-label="Primary navigation">
            <a className="nav-link" href="#how-it-works">How it works</a>
            <a className="nav-link" href="#platforms">Platforms</a>
            <a className="nav-link" href="#faq">FAQ</a>
          </nav>
          <a className="header-github" href="https://github.com/Blackie360/Tailhome" aria-label="TailHome on GitHub">
            <Github className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </header>

        <div className="container relative z-10 grid min-h-[760px] items-center gap-14 pb-24 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:pb-32 lg:pt-20">
          <div className="max-w-2xl">
            <p className="eyebrow eyebrow-dark"><span className="status-dot" /> Your cloud. At home.</p>
            <h1 className="display-title mt-6 text-white">A private cloud<br /><span className="text-gradient">that feels effortless.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
              One command turns your home server into a secure, observable service stack—available anywhere on your Tailscale network.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-full bg-emerald-300 px-6 font-bold text-slate-950 hover:bg-emerald-200">
                <a href="#install">Build your install <ArrowRight className="size-4" /></a>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full border-white/15 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
                <a href="#stack">Explore the stack</a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <span className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" /> No port forwarding</span>
              <span className="flex items-center gap-2"><Check className="size-3.5 text-emerald-300" /> No subscription</span>
            </div>
          </div>

          <NetworkHero />
        </div>
        <div className="container relative z-10 -mt-12 pb-16 lg:-mt-20">
          <div className="step-rail" aria-label="How TailHome works in three steps">
            {steps.map((step) => <article className="step-card" key={step.number}><span>{step.number}</span><div><h2>{step.title}</h2><p>{step.body}</p></div></article>)}
          </div>
        </div>
        <div className="hero-glow" />
      </section>

      <section className="bg-white py-24 sm:py-32" id="how-it-works">
        <div className="container grid items-center gap-14 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="eyebrow">The private path</p><h2 className="section-title mt-5">Reach home.<br />Never expose it.</h2><p className="mt-6 text-lg leading-8 text-muted-foreground">Your device reaches TailHome through Tailscale’s encrypted mesh. The host stays yours, and services remain on your hardware instead of moving into someone else’s cloud.</p><div className="mt-8 rounded-2xl border bg-[#f5f7f3] p-5 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">No port forwarding required.</strong> Access is governed by membership and policy in your tailnet. TailHome does expose ports on the host, so keep your firewall rules limited to trusted networks.</div></div>
          <ArchitectureDiagram />
        </div>
      </section>

      <section className="relative bg-[#f5f7f3] py-24 sm:py-32" id="stack">
        <div className="container">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Everything connected</p>
              <h2 className="section-title mt-5">Your essential services,<br />already talking.</h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground lg:justify-self-end">
              TailHome assembles a considered homelab, not a pile of containers. Monitoring, DNS, dashboards, and updates arrive configured as one private system.
            </p>
          </div>

          <div className="service-stage mt-16">
            <div className="service-list">
              {services.map((service, index) => (
                <div className="service-row" key={service.name}>
                  <span className={`service-icon service-icon-${service.color}`}>{service.name.slice(0, 1)}</span>
                  <div className="min-w-0 flex-1"><h3 className="font-display text-lg font-bold">{service.name}</h3><p className="text-sm text-muted-foreground">tailhome:{service.port}</p></div>
                  <span className="live-pill"><span /> live</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">0{index + 1}</span>
                </div>
              ))}
            </div>
            <aside className="observability-panel">
              <div className="flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-widest text-white/50">System pulse</p><span className="live-pill dark"><span /> all systems</span></div>
              <div className="mt-10"><span className="metric text-white">99.98</span><span className="font-display text-3xl text-emerald-300">%</span><p className="mt-2 text-sm text-white/50">30-day availability</p></div>
              <div className="chart mt-10" aria-label="Uptime trend over the last 24 hours">
                {[42,55,48,65,60,72,69,80,74,88,83,94,87,96,91,98].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}
              </div>
              <div className="mt-7 grid grid-cols-2 gap-4 border-t border-white/10 pt-6"><MiniMetric value="8" label="services" /><MiniMetric value="14ms" label="latency" /></div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-32" id="cli">
        <div className="container grid items-center gap-14 lg:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="eyebrow">One calm interface</p>
            <h2 className="section-title mt-5">Control the whole house from one command.</h2>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">A small, fast Go CLI handles the everyday work. Human-readable output, predictable commands, zero dashboard hunting.</p>
            <div className="mt-9 divide-y divide-border border-y">
              {commands.map(([command, detail]) => <div className="flex items-center gap-4 py-4" key={command}><ChevronRight className="size-4 text-primary" /><code className="w-20 font-bold text-foreground">{command}</code><span className="text-sm text-muted-foreground">{detail}</span></div>)}
            </div>
          </div>
          <TerminalPreview />
        </div>
      </section>

      <section className="bg-[#edf2ed] py-24 sm:py-32" id="install">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center"><p className="eyebrow justify-center">Start building</p><h2 className="section-title mt-5">Your server, your choices.</h2><p className="mt-5 text-lg text-muted-foreground">Tune the install, copy one command, and let TailHome do the wiring.</p></div>
          <div className="installer-wrap"><CommandBuilder /></div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            <TrustCard icon={HardDrive} title="What it changes" body="Checks ports, installs Tailscale and Docker if needed, installs the CLI, creates the Compose stack, and starts selected services." />
            <TrustCard icon={Archive} title="Where it lives" body="Compose files, service configuration, and environment values live together in /opt/tailhome by default. The CLI installs to /usr/local/bin." />
            <TrustCard icon={KeyRound} title="How secrets work" body="Grafana and Pi-hole passwords are generated during setup and written to /opt/tailhome/.env. The CLI hides secrets when printing environment values." />
          </div>
        </div>
      </section>

      <section className="bg-white py-24 sm:py-32" id="platforms">
        <div className="container"><div className="max-w-3xl"><p className="eyebrow">Know before you install</p><h2 className="section-title mt-5">Full server on Linux.<br />The CLI everywhere else.</h2></div>
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <article className="platform-card platform-primary"><span className="platform-pill">Full stack</span><h3>Raspberry Pi OS, Debian &amp; Ubuntu</h3><p>The complete installer can add Tailscale and Docker, deploy the service stack, and install the CLI. Release binaries cover Linux amd64, arm64, armv7, and armv6.</p><ul><li><Check /> Docker Compose services</li><li><Check /> Tailscale host setup</li><li><Check /> Day-to-day CLI</li></ul></article>
            <article className="platform-card"><span className="platform-pill muted">CLI only</span><h3>macOS &amp; Windows</h3><p>Use these computers to operate TailHome, not to host the full Docker stack. CLI releases support macOS Intel and Apple silicon, plus Windows amd64 and arm64.</p><ul><li><Laptop /> macOS shell installer</li><li><TerminalSquare /> Windows PowerShell installer</li><li><Check /> Connect to a Linux host</li></ul></article>
          </div>
        </div>
      </section>

      <section className="relative bg-[#07120f] py-24 text-white sm:py-32">
        <div className="absolute inset-0 grid-field opacity-40" />
        <div className="container relative grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="eyebrow eyebrow-dark">Proof, not promises</p><h2 className="section-title mt-5 text-white">Infrastructure you can inspect and own.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">TailHome keeps the machinery visible: Compose files you can reproduce, commands you can read, and backups you control.</p><a className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-emerald-200" href="https://github.com/Blackie360/Tailhome">Inspect the source <ArrowRight className="size-4" /></a></div>
          <div className="principles-grid">
            <Principle icon={Github} number="01" title="Open source" body="The installer and CLI are published under the MIT License." />
            <Principle icon={HardDrive} number="02" title="Self-hosted" body="Services and their data run on hardware you control." />
            <Principle icon={KeyRound} number="03" title="Generated passwords" body="Service credentials are created at install, not shipped as shared defaults." />
            <Principle icon={Archive} number="04" title="Portable backups" body="tailhome backup archives the complete install directory with a timestamp." />
          </div>
        </div>
      </section>

      <section className="bg-[#f5f7f3] py-24 sm:py-32" id="faq"><div className="container grid gap-14 lg:grid-cols-[.7fr_1.3fr]"><div><p className="eyebrow">Questions, answered</p><h2 className="section-title mt-5">Clear before you commit.</h2><p className="mt-6 text-muted-foreground">From a first Raspberry Pi to an established home server, the same configuration remains readable and yours.</p></div><div className="faq-list"><Faq question="What can I use TailHome for?">Run a private dashboard, monitoring, uptime checks, DNS filtering, container management, and reverse-proxy shortcuts for your household or homelab.</Faq><Faq question="Does it open my server to the internet?">TailHome does not require router port forwarding. Services bind on the host, so use Tailscale and appropriate firewall rules to restrict who can reach them.</Faq><Faq question="Can I see or change the configuration?">Yes. The generated Docker Compose and service configuration live under /opt/tailhome by default, making the install inspectable and reproducible.</Faq><Faq question="How do updates and backups work?">Use tailhome update to pull and restart services, and tailhome backup to create a timestamped archive of the complete TailHome directory.</Faq><Faq question="Where is the documentation?"><a className="font-bold text-primary hover:underline" href="https://github.com/Blackie360/Tailhome/blob/main/apps/tailhome/README.md">Read the install, command, service, and security guide on GitHub ↗</a></Faq></div></div></section>

      <section className="bg-emerald-300 py-20"><div className="container flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div><p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-emerald-950/60">Your cloud starts at home</p><h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Ready to make your server yours?</h2></div><div className="flex flex-wrap gap-3"><Button asChild className="h-12 rounded-full bg-slate-950 px-6 font-bold text-white hover:bg-slate-800"><a href="#install">Build my install <ArrowRight className="size-4" /></a></Button><Button asChild variant="outline" className="h-12 rounded-full border-slate-950/20 bg-transparent px-6 font-bold text-slate-950 hover:bg-white/40"><a href="https://github.com/Blackie360/Tailhome"><Github className="size-4" /> View on GitHub</a></Button></div></div></section>

      <footer className="bg-[#07120f] text-white"><div className="container flex flex-col gap-6 border-t border-white/10 py-8 sm:flex-row sm:items-center sm:justify-between"><Logo /><p className="text-sm text-white/40">Private infrastructure for the places that matter.</p><a className="text-sm text-white/60 hover:text-white" href="https://github.com/Blackie360/Tailhome">Open source on GitHub ↗</a></div></footer>
    </main>
  );
}

function Logo() {
  return <a className="group flex items-center gap-3" href="#top" aria-label="TailHome home"><span className="logo-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M7 19.5 20 8l13 11.5V32a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V19.5Z" stroke="currentColor" strokeWidth="2"/><path d="M14 34V23h12v11M11 16.5h18" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="18" r="2.5" fill="currentColor"/></svg></span><span className="font-display text-lg font-bold tracking-tight text-white">Tail<span className="text-emerald-300">Home</span></span></a>;
}

function NetworkHero() {
  return <div className="network-canvas" aria-label="Diagram showing a home server connected through Tailscale to personal devices and managed services">
    <div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" />
    <div className="network-node server-node"><span className="node-icon"><Cpu /></span><div><strong>Home server</strong><small>tailhome.local</small></div><i className="online-dot" /></div>
    <div className="network-node tail-node"><span className="node-icon"><Network /></span><div><strong>Tailscale</strong><small>encrypted mesh</small></div></div>
    <div className="network-node device-node"><span className="node-icon"><Globe2 /></span><div><strong>Your devices</strong><small>anywhere</small></div></div>
    <div className="network-node cloud-node"><span className="node-icon"><Cloud /></span><div><strong>8 services</strong><small>managed locally</small></div></div>
    <svg className="network-lines" viewBox="0 0 620 540" preserveAspectRatio="none" aria-hidden="true"><path d="M156 277 C220 277 220 270 287 270"/><path d="M380 270 C460 270 455 150 508 150"/><path d="M380 270 C455 270 456 396 510 396"/></svg>
    <div className="packet packet-one" /><div className="packet packet-two" /><p className="network-caption"><span /> secured by WireGuard®</p>
  </div>;
}

function ArchitectureDiagram() { return <figure className="architecture" aria-label="Your device connects through a Tailscale network to a TailHome host and its private services"><div className="architecture-flow"><ArchitectureNode icon={UserRound} eyebrow="You" title="Phone or laptop" /><span className="architecture-link"><i /> encrypted</span><ArchitectureNode icon={Network} eyebrow="Your tailnet" title="Tailscale mesh" featured /><span className="architecture-link"><i /> private</span><ArchitectureNode icon={Cpu} eyebrow="Your hardware" title="TailHome host" /></div><div className="architecture-services"><span>Homepage</span><span>Grafana</span><span>Pi-hole</span><span>Uptime Kuma</span></div><figcaption>Identity-aware access in. Private Docker services behind your TailHome host.</figcaption></figure>; }
function ArchitectureNode({icon:Icon,eyebrow,title,featured=false}:{icon:LucideIcon;eyebrow:string;title:string;featured?:boolean}) { return <div className={`architecture-node ${featured ? "featured" : ""}`}><Icon /><span>{eyebrow}</span><strong>{title}</strong></div>; }
function TrustCard({icon:Icon,title,body}:{icon:LucideIcon;title:string;body:string}) { return <article className="trust-card"><Icon /><h3>{title}</h3><p>{body}</p></article>; }
function Faq({question,children}:{question:string;children:React.ReactNode}) { return <details className="faq-item"><summary>{question}<span>+</span></summary><div>{children}</div></details>; }

function TerminalPreview() {
  return <div className="terminal-window surface-glow"><div className="terminal-bar"><div className="flex gap-2"><span /><span /><span /></div><p>tailhome — status</p><div /></div><div className="terminal-body"><p className="text-white/40">$ <span className="text-white">tailhome status</span></p><div className="mt-8 flex items-center gap-3"><LogoMarkSmall /><div><strong className="font-display text-xl text-white">TailHome</strong><p className="text-xs text-white/40">home server control plane</p></div></div><div className="mt-8 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-4 border-t border-white/10 pt-6 text-sm"><span className="text-white/40">SERVICE</span><span className="text-white/40">PORT</span><span className="text-white/40">STATE</span>{[["homepage","3000"],["grafana","3001"],["prometheus","9090"],["uptime-kuma","3002"]].map(([name,port]) => <TerminalRow key={name} name={name} port={port} />)}</div><p className="mt-7 text-emerald-300">✓ 8 services healthy <span className="text-white/30">in 38ms</span></p></div></div>;
}
function TerminalRow({name,port}:{name:string;port:string}) { return <><span className="text-slate-200">{name}</span><span className="text-white/50">:{port}</span><span className="text-emerald-300">● running</span></>; }
function LogoMarkSmall() { return <span className="grid size-11 place-items-center rounded-xl bg-emerald-300 text-slate-950"><TerminalSquare className="size-5" /></span>; }
function MiniMetric({value,label}:{value:string;label:string}) { return <div><strong className="font-display text-2xl text-white">{value}</strong><p className="mt-1 text-xs uppercase tracking-wider text-white/40">{label}</p></div>; }
function Principle({icon:Icon,number,title,body}:{icon:LucideIcon;number:string;title:string;body:string}) { return <article className="principle"><div className="flex items-center justify-between"><Icon className="size-6 text-emerald-300" /><span className="font-mono text-xs text-white/30">{number}</span></div><h3 className="mt-8 font-display text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{body}</p></article>; }
