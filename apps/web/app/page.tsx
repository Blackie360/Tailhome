import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Github,
  Globe2,
  HardDrive,
  ShieldCheck,
  TerminalSquare,
  Zap
} from "lucide-react";
import { CommandBuilder } from "@/components/command-builder";
import { NetworkHero } from "@/components/network-hero";
import { PrimaryNavigation } from "@/components/primary-navigation";
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

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="hero-shell grid-field" id="top">
        <header className="container relative z-20 flex h-20 items-center justify-between">
          <Logo />
          <PrimaryNavigation />
          <a className="header-github" href="https://github.com/Blackie360/Tailhome" aria-label="TailHome on GitHub">
            <Github className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </header>

        <div className="container relative z-10 grid min-h-[760px] items-center gap-14 pb-24 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:pb-32 lg:pt-20">
          <div className="max-w-2xl entrance-copy">
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
        <div className="hero-glow" />
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
        </div>
      </section>

      <section className="relative bg-[#07120f] py-24 text-white sm:py-32" id="deploy">
        <div className="absolute inset-0 grid-field opacity-40" />
        <div className="container relative grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div><p className="eyebrow eyebrow-dark">Private by design</p><h2 className="section-title mt-5 text-white">No public doors.<br />No mystery middlemen.</h2><p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">Tailscale creates the encrypted path. TailHome gives everything behind it a dependable place to live.</p></div>
          <div className="principles-grid">
            <Principle icon={ShieldCheck} number="01" title="Identity first" body="Only devices in your tailnet can reach the stack." />
            <Principle icon={Zap} number="02" title="Ready in minutes" body="Sensible defaults without surrendering control." />
            <Principle icon={HardDrive} number="03" title="Local forever" body="Your data stays on hardware you own." />
            <Principle icon={Globe2} number="04" title="Available anywhere" body="The same private URLs, at home or away." />
          </div>
        </div>
      </section>

      <footer className="bg-[#07120f] text-white"><div className="container flex flex-col gap-6 border-t border-white/10 py-8 sm:flex-row sm:items-center sm:justify-between"><Logo /><p className="text-sm text-white/40">Private infrastructure for the places that matter.</p><a className="text-sm text-white/60 hover:text-white" href="https://github.com/Blackie360/Tailhome">Open source on GitHub ↗</a></div></footer>
    </main>
  );
}

function Logo() {
  return <a className="group flex items-center gap-3" href="#top" aria-label="TailHome home"><span className="logo-mark" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M7 19.5 20 8l13 11.5V32a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V19.5Z" stroke="currentColor" strokeWidth="2"/><path d="M14 34V23h12v11M11 16.5h18" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="18" r="2.5" fill="currentColor"/></svg></span><span className="font-display text-lg font-bold tracking-tight text-white">Tail<span className="text-emerald-300">Home</span></span></a>;
}

function TerminalPreview() {
  return <div className="terminal-window surface-glow"><div className="terminal-bar"><div className="flex gap-2"><span /><span /><span /></div><p>tailhome — status</p><div /></div><div className="terminal-body"><p className="text-white/40">$ <span className="text-white">tailhome status</span></p><div className="mt-8 flex items-center gap-3"><LogoMarkSmall /><div><strong className="font-display text-xl text-white">TailHome</strong><p className="text-xs text-white/40">home server control plane</p></div></div><div className="mt-8 grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-4 border-t border-white/10 pt-6 text-sm"><span className="text-white/40">SERVICE</span><span className="text-white/40">PORT</span><span className="text-white/40">STATE</span>{[["homepage","3000"],["grafana","3001"],["prometheus","9090"],["uptime-kuma","3002"]].map(([name,port]) => <TerminalRow key={name} name={name} port={port} />)}</div><p className="mt-7 text-emerald-300">✓ 8 services healthy <span className="text-white/30">in 38ms</span></p></div></div>;
}
function TerminalRow({name,port}:{name:string;port:string}) { return <><span className="text-slate-200">{name}</span><span className="text-white/50">:{port}</span><span className="text-emerald-300">● running</span></>; }
function LogoMarkSmall() { return <span className="grid size-11 place-items-center rounded-xl bg-emerald-300 text-slate-950"><TerminalSquare className="size-5" /></span>; }
function MiniMetric({value,label}:{value:string;label:string}) { return <div><strong className="font-display text-2xl text-white">{value}</strong><p className="mt-1 text-xs uppercase tracking-wider text-white/40">{label}</p></div>; }
function Principle({icon:Icon,number,title,body}:{icon:LucideIcon;number:string;title:string;body:string}) { return <article className="principle"><div className="flex items-center justify-between"><Icon className="size-6 text-emerald-300" /><span className="font-mono text-xs text-white/30">{number}</span></div><h3 className="mt-8 font-display text-xl font-bold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{body}</p></article>; }
