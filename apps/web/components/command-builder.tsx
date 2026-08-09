"use client";

import { Check, Clipboard, Laptop, Monitor, Terminal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const [copied, setCopied] = useState(false);

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
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="subnet">Subnet route</Label>
              <Input
                id="subnet"
                value={subnet}
                onChange={(event) => setSubnet(event.target.value)}
                placeholder="192.168.1.0/24"
              />
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
          <code className="min-h-[54px] overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-lime-100">
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
                  aria-label="Copy command"
                >
                  {copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied" : "Copy command"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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

function shellValue(value: string) {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) {
    return value;
  }
  return `'${value.replaceAll("'", "'\\''")}'`;
}
