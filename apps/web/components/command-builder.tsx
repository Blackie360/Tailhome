"use client";

import { Check, Clipboard, Laptop, Monitor, Terminal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { shellValue, validateCidr, validateHostname } from "@/lib/installer-command";

type Platform = "linux" | "macos" | "windows";
type Mode = "full" | "cli" | "safe";

const shellInstallerUrl = "https://tailhome.blackielabs.com/install.sh";
const powershellInstallerUrl = "https://tailhome.blackielabs.com/install.ps1";

export function CommandBuilder() {
  const [mode, setMode] = useState<Mode>("full");
  const [platform, setPlatform] = useState<Platform>("linux");
  const [hostname, setHostname] = useState("tailhome");
  const [subnet, setSubnet] = useState("");
  const [exitNode, setExitNode] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "manual">("idle");
  const commandRef = useRef<HTMLElement>(null);

  const hostnameError = platform === "linux" && mode !== "cli" ? validateHostname(hostname) : null;
  const subnetError = platform === "linux" && mode !== "cli" ? validateCidr(subnet) : null;
  const commandIsValid = !hostnameError && !subnetError;

  useEffect(() => {
    const detected = detectPlatform();
    setPlatform(detected);
    if (detected !== "linux") {
      setMode("cli");
    }
  }, []);

  const command = useMemo(() => {
    if (platform === "windows") {
      return `powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr ${powershellInstallerUrl} -UseB | iex"`;
    }

    if (platform === "macos" || mode === "cli") {
      return `curl -fsSL ${shellInstallerUrl} | bash -s -- --cli-only`;
    }

    const env: string[] = [];
    const args: string[] = [];

    if (hostname.trim() && hostname.trim() !== "tailhome") {
      env.push(`TAILHOME_HOSTNAME=${shellValue(hostname.trim())}`);
    }
    if (subnet.trim()) {
      env.push(`TAILHOME_SUBNET_ROUTES=${shellValue(subnet.trim())}`);
    }
    if (exitNode) {
      env.push("TAILHOME_ENABLE_EXIT_NODE=1");
    }

    if (mode === "safe") {
      env.push("TAILHOME_USE_SUDO=0");
      env.push("TAILHOME_DIR=/tmp/tailhome-test");
      env.push("TAILHOME_BIN_DIR=/tmp/tailhome-bin");
      args.push("--skip-tailscale-install");
      args.push("--skip-tailscale-login");
      args.push("--skip-docker-install");
      args.push("--no-start");
    }

    const bashCommand = args.length > 0 ? ["bash", "-s", "--", ...args].join(" ") : "bash";

    if (env.length > 0) {
      return `curl -fsSL ${shellInstallerUrl} | env ${env.join(" ")} ${bashCommand}`;
    }

    return `curl -fsSL ${shellInstallerUrl} | ${bashCommand}`;
  }, [exitNode, hostname, mode, platform, subnet]);

  async function copyCommand() {
    if (!commandIsValid) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(command);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      if (selection && commandRef.current) {
        range.selectNodeContents(commandRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopyStatus("manual");
    }
  }

  return (
    <Card className="rounded-lg shadow-surface" aria-label="Installer command builder">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Terminal aria-hidden="true" className="size-5 text-primary" />
          <CardTitle>Installer</CardTitle>
        </div>
        <CardDescription>{descriptionFor(platform, mode)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={platform}
          onValueChange={(value) => {
            const nextPlatform = value as Platform;
            setPlatform(nextPlatform);
            if (nextPlatform !== "linux") {
              setMode("cli");
            } else if (mode === "cli") {
              setMode("full");
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="linux">
              <Monitor aria-hidden="true" className="mr-2 size-4" />
              Linux
            </TabsTrigger>
            <TabsTrigger value="macos">
              <Laptop aria-hidden="true" className="mr-2 size-4" />
              macOS
            </TabsTrigger>
            <TabsTrigger value="windows">
              <Monitor aria-hidden="true" className="mr-2 size-4" />
              Windows
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {platform === "linux" ? (
          <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="full">Full</TabsTrigger>
              <TabsTrigger value="cli">CLI</TabsTrigger>
              <TabsTrigger value="safe">Safe</TabsTrigger>
            </TabsList>
            <p className="mt-2 text-sm text-muted-foreground">{modeExplanation(mode)}</p>
          </Tabs>
        ) : null}

        {platform === "linux" && mode !== "cli" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="hostname">Hostname</Label>
              <Input
                id="hostname"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="tailhome"
                aria-invalid={Boolean(hostnameError)}
                aria-describedby={hostnameError ? "hostname-error" : undefined}
              />
              {hostnameError ? (
                <p id="hostname-error" role="alert" className="text-sm text-destructive">
                  {hostnameError}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subnet">Subnet route</Label>
              <Input
                id="subnet"
                value={subnet}
                onChange={(event) => setSubnet(event.target.value)}
                placeholder="192.168.1.0/24"
                aria-invalid={Boolean(subnetError)}
                aria-describedby={subnetError ? "subnet-error" : "subnet-help"}
              />
              {subnetError ? (
                <p id="subnet-error" role="alert" className="text-sm text-destructive">
                  {subnetError}
                </p>
              ) : (
                <p id="subnet-help" className="text-xs text-muted-foreground">
                  Optional IPv4 or IPv6 network in CIDR notation.
                </p>
              )}
            </div>

            <div className="flex min-h-11 items-center justify-between gap-4 rounded-md border bg-background px-3">
              <Label htmlFor="exit-node" className="text-foreground">
                Advertise exit node
              </Label>
              <Switch id="exit-node" checked={exitNode} onCheckedChange={setExitNode} />
            </div>
          </>
        ) : null}

        {platform !== "linux" ? (
          <div className="flex min-h-11 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
            {platform === "macos"
              ? "macOS installs the TailHome CLI. The Docker stack installer runs on Linux."
              : "Windows installs the TailHome CLI. The Docker stack installer runs on Linux."}
          </div>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2">
          <code
            ref={commandRef}
            className="min-h-[54px] overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-lime-100"
          >
            {command}
          </code>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="self-start"
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={copyCommand}
                  aria-label={commandIsValid ? "Copy command" : "Fix validation errors before copying"}
                  disabled={!commandIsValid}
                >
                  {copyStatus === "copied" ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copyStatus === "copied" ? "Copied" : commandIsValid ? "Copy command" : "Fix errors first"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {copyStatus === "copied"
            ? "Installer command copied to clipboard."
            : copyStatus === "manual"
              ? "Clipboard access failed. The command is selected; copy it manually."
              : ""}
        </p>
        {copyStatus === "manual" ? (
          <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
            Clipboard access failed. The command is selected; press Ctrl+C (or Command+C on macOS) to copy it
            manually.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Inspect the{" "}
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="/install.sh"
          >
            installer source
          </a>{" "}
          and{" "}
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="https://github.com/Blackie360/Tailhome/tree/main/apps/tailhome#readme"
          >
            documentation
          </a>{" "}
          before running it.
        </p>
      </CardContent>
    </Card>
  );
}

function detectPlatform(): Platform {
  const nav = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };
  const source = `${nav.userAgentData?.platform ?? ""} ${navigator.platform} ${navigator.userAgent}`.toLowerCase();

  if (source.includes("win")) {
    return "windows";
  }
  if (source.includes("mac")) {
    return "macos";
  }
  return "linux";
}

function descriptionFor(platform: Platform, mode: Mode) {
  if (platform === "windows") {
    return "PowerShell command for the Windows CLI installer.";
  }
  if (platform === "macos") {
    return "Shell command for the macOS CLI installer.";
  }
  if (mode === "cli") {
    return "Shell command for the Linux CLI installer.";
  }
  if (mode === "safe") {
    return "Shell command for a Linux no-start path test.";
  }
  return "Shell command for the Linux full stack installer.";
}

function modeExplanation(mode: Mode) {
  if (mode === "cli") {
    return "CLI installs only the command-line client; it does not deploy or start the Docker service stack.";
  }
  if (mode === "safe") {
    return "Safe downloads and stages files under /tmp without sudo, dependency installs, Tailscale login, or starting services; use it to inspect a low-impact dry run.";
  }
  return "Full may use sudo, install Tailscale and Docker, authenticate Tailscale, and start network-facing containers; review the script and firewall exposure first.";
}
