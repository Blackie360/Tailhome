"use client";

import { Check, Clipboard } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";
import { installerCommandFor } from "@/lib/installer-command";

export function HeroCommand() {
  const command = installerCommandFor("linux");
  const commandRef = useRef<HTMLElement>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "manual">("idle");

  async function copyCommand() {
    const status = await copyText(command, commandRef.current);
    setCopyStatus(status);
    if (status === "copied") {
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    }
  }

  return (
    <div className="hero-command">
      <p className="hero-command-label">Linux full stack</p>
      <div className="hero-command-row">
        <code ref={commandRef} translate="no">
          {command}
        </code>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          onClick={copyCommand}
          aria-label="Copy Linux install command"
        >
          {copyStatus === "copied" ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {copyStatus === "copied"
          ? "Linux install command copied to clipboard."
          : copyStatus === "manual"
            ? "Clipboard access failed. The command is selected; copy it manually."
            : ""}
      </p>
      {copyStatus === "manual" ? (
        <p role="status" className="hero-command-manual">
          Clipboard access failed. The command is selected; press Ctrl+C (or Command+C on macOS) to copy it.
        </p>
      ) : null}
    </div>
  );
}
