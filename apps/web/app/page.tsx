import Image from "next/image";
import type { ReactNode } from "react";
import {
  Cable,
  CheckCircle2,
  Github,
  HardDrive,
  Lock,
  Network,
  Shield,
  TerminalSquare
} from "lucide-react";
import { CommandBuilder } from "@/components/command-builder";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

const services = [
  { name: "Homepage", port: "3000", role: "service directory" },
  { name: "Grafana", port: "3001", role: "metrics dashboards" },
  { name: "Prometheus", port: "9090", role: "monitoring store" },
  { name: "Uptime Kuma", port: "3002", role: "uptime checks" },
  { name: "Portainer", port: "9443", role: "container control" },
  { name: "Pi-hole", port: "8080", role: "DNS filtering" },
  { name: "Caddy", port: "8088", role: "local routing" },
  { name: "Watchtower", port: "daily", role: "image updates" }
];

const commands = [
  ["tailhome status", "Show the Compose stack"],
  ["tailhome urls", "Print service URLs"],
  ["tailhome config", "Show active configuration"],
  ["tailhome env", "Print masked environment"],
  ["tailhome update", "Pull and restart services"],
  ["tailhome backup", "Archive the install directory"]
];

const checks = [
  "Tailscale SSH login",
  "Docker Compose stack",
  "Generated service passwords",
  "CLI installed as tailhome",
  "Private service URLs"
];

const deploySteps = [
  { icon: Network, text: "DNS points to the web host" },
  { icon: Lock, text: "TLS terminates at the host or reverse proxy" },
  { icon: Cable, text: "Installer endpoints serve shell and PowerShell scripts" },
  { icon: HardDrive, text: "Release downloads serve Linux, macOS, and Windows CLI binaries" }
];

export default function Home() {
  return (
    <main>
      <section className="relative min-h-[86vh] overflow-hidden text-white">
        <Image
          className="object-cover"
          src="/images/tailhome-hero.png"
          alt="A compact TailHome homelab control hub on a home office shelf"
          priority
          fill
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,15,13,0.82)_0%,rgba(13,15,13,0.58)_42%,rgba(13,15,13,0.18)_100%),linear-gradient(0deg,rgba(13,15,13,0.62)_0%,rgba(13,15,13,0)_36%)]" />

        <header className="container relative z-10 flex items-center justify-between gap-6 py-5 max-sm:flex-col max-sm:items-start">
          <a className="flex items-center gap-2 font-bold" href="#top" aria-label="TailHome home">
            <span className="grid size-[34px] place-items-center rounded-lg border border-white/40 bg-white/10 text-[13px]">
              TH
            </span>
            <span>TailHome</span>
          </a>
          <nav
            className="flex items-center gap-5 text-sm text-white/85 max-sm:w-full max-sm:justify-between"
            aria-label="Primary navigation"
          >
            <a href="#stack">Stack</a>
            <a href="#cli">CLI</a>
            <a href="#deploy">Deploy</a>
          </nav>
        </header>

        <div className="container relative z-10 pb-32 pt-24 max-sm:pb-28 max-sm:pt-14" id="top">
          <p className="mb-3 text-sm font-bold uppercase text-lime-200">
            tailhome.blackielabs.com
          </p>
          <h1 className="max-w-2xl text-[68px] font-bold leading-[0.94] max-md:text-5xl max-sm:text-4xl">
            TailHome
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-8 text-white/90 max-sm:text-lg">
            Install a private Tailscale homelab stack on Raspberry Pi OS, Debian, or Ubuntu,
            with CLI binaries available for Linux, macOS, and Windows.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="secondary" className="bg-white text-foreground hover:bg-white/90">
              <a href="#install">
                <TerminalSquare aria-hidden="true" />
                Build command
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <a href="https://github.com/Blackie360/Tailhome">
                <Github aria-hidden="true" />
                GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-secondary py-8" id="install">
        <div className="container grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <CommandBuilder />
          <Card className="rounded-lg shadow-surface">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Shield aria-hidden="true" className="size-5 text-primary" />
                <CardTitle>Runtime</CardTitle>
              </div>
              <CardDescription>Installer checkpoints for a normal TailHome setup.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {checks.map((check) => (
                <div className="flex min-h-10 items-center gap-3 text-sm text-muted-foreground" key={check}>
                  <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  <span>{check}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-20 max-sm:py-14" id="stack">
        <div className="container">
          <SectionHeading
            eyebrow="Default Stack"
            title="Private services, ready after install"
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <Card className="min-h-32 rounded-lg" key={service.name}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-5">
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <CardDescription className="mt-2 leading-relaxed">{service.role}</CardDescription>
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-amber-800">
                    {service.port}
                  </span>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card py-20 max-sm:py-14" id="cli">
        <div className="container grid gap-8 lg:grid-cols-[0.82fr_1.18fr]">
          <SectionHeading
            eyebrow="Go CLI"
            title="Operate the stack from one command"
            body={
              <>
                Source lives at <code>apps/tailhome/cmd/tailhome</code>. Release binaries can be
                attached to GitHub Releases for installs that do not have Go available.
              </>
            }
          />
          <div className="grid gap-3 md:grid-cols-2">
            {commands.map(([command, detail]) => (
              <Card className="min-h-24 rounded-lg" key={command}>
                <CardContent className="p-5">
                  <code className="font-bold text-accent">{command}</code>
                  <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted py-20 max-sm:py-14" id="deploy">
        <div className="container grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            eyebrow="Deploy Target"
            title="Ready for tailhome.blackielabs.com"
            body="The Next.js app is configured with canonical metadata for the domain and can be deployed as a standalone Node build."
          />
          <div className="grid gap-3 md:grid-cols-2" aria-label="Deployment checklist">
            {deploySteps.map(({ icon: Icon, text }) => (
              <Card className="rounded-lg" key={text}>
                <CardContent className="flex min-h-20 items-center gap-3 p-5 text-sm text-muted-foreground">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-amber-700" />
                  <span>{text}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="container flex justify-between gap-4 py-7 text-sm text-muted-foreground max-sm:flex-col">
        <span>TailHome</span>
        <span>tailhome.blackielabs.com</span>
      </footer>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body
}: {
  eyebrow: string;
  title: string;
  body?: ReactNode;
}) {
  return (
    <div className="mb-7 max-w-2xl">
      <p className="mb-3 text-sm font-bold uppercase text-primary">{eyebrow}</p>
      <h2 className="text-4xl font-bold leading-tight max-sm:text-3xl">{title}</h2>
      {body ? <p className="mt-4 text-base leading-7 text-muted-foreground">{body}</p> : null}
    </div>
  );
}
