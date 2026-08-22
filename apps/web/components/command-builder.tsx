"use client";

import { Check, Clipboard, Laptop, Monitor, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { copyText } from "@/lib/copy-text";
import { installerCommandFor, type InstallerPlatform } from "@/lib/installer-command";

type Platform = InstallerPlatform;

export function CommandBuilder() {
  const [platform, setPlatform] = useState<Platform>("linux");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "manual">("idle");
  const commandRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const command = installerCommandFor(platform);

  async function copyCommand() {
    const status = await copyText(command, commandRef.current);
    setCopyStatus(status);
    if (status === "copied") {
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    }
  }

  return (
    <Card className="rounded-lg shadow-surface" aria-label="Installer command builder">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Terminal aria-hidden="true" className="size-5 text-primary" />
          <CardTitle>Installer</CardTitle>
        </div>
        <CardDescription>{descriptionFor(platform)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={platform} onValueChange={(value) => setPlatform(value as Platform)}>
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

        <div className="flex min-h-11 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
          {platformNote(platform)}
        </div>

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
                  aria-label="Copy command"
                >
                  {copyStatus === "copied" ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copyStatus === "copied" ? "Copied" : "Copy command"}
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
        <div className="rounded-md border bg-muted/35 p-4">
          <p className="text-sm font-semibold text-foreground">{nextStepsHeading(platform)}</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            {nextStepsFor(platform).map((step) => (
              <li className="flex gap-2" key={step}>
                <Check aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm text-muted-foreground">
          Fresh Linux installs enable monitoring, uptime, management, and DNS by default. For a lighter install, run with{" "}
          <code>TAILHOME_PROFILES=monitoring</code> for a subset or <code>TAILHOME_PROFILES=</code> for core-only.
        </p>
        <p className="text-sm text-muted-foreground">
          Inspect the{" "}
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href="/install"
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

function descriptionFor(platform: Platform) {
  if (platform === "windows") {
    return "PowerShell command for the Windows CLI installer.";
  }
  if (platform === "macos") {
    return "Shell command for the macOS CLI installer.";
  }
  return "Shell command for the Linux full stack installer.";
}

function platformNote(platform: Platform) {
  if (platform === "windows") {
    return "Windows installs the TailHome CLI. The Docker stack installer runs on Linux.";
  }
  if (platform === "macos") {
    return "macOS installs the TailHome CLI. The Docker stack installer runs on Linux.";
  }
  return "Use the same Linux installer on x86, ARM, and Raspberry Pi hosts.";
}

function nextStepsHeading(platform: Platform) {
  if (platform === "linux") {
    return "After you copy it";
  }
  return "After the CLI installs";
}

function nextStepsFor(platform: Platform) {
  if (platform === "linux") {
    return [
      "Paste the command on a supported Linux host: Raspberry Pi OS, Debian, Ubuntu, x86, or ARM.",
      "Complete the Tailscale login prompt so the host joins your tailnet.",
      "Open Homepage with tailhome urls; it prints the resolved local and private URLs."
    ];
  }

  return [
    "Install the full stack on a supported Linux host when you are ready.",
    "Join the Linux host and this device to the same Tailscale tailnet.",
    "Use tailhome urls to open Homepage and the private service endpoints."
  ];
}
