"use client";

import { Cloud, Cpu, Globe2, Network } from "lucide-react";
import { useRef } from "react";

export function NetworkHero() {
  const frame = useRef<number>();

  function moveArtwork(event: React.PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    cancelAnimationFrame(frame.current ?? 0);
    frame.current = requestAnimationFrame(() => {
      canvas.style.setProperty("--parallax-x", x.toFixed(3));
      canvas.style.setProperty("--parallax-y", y.toFixed(3));
    });
  }

  function resetArtwork(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--parallax-x", "0");
    event.currentTarget.style.setProperty("--parallax-y", "0");
  }

  return (
    <div className="network-canvas entrance-art" onPointerMove={moveArtwork} onPointerLeave={resetArtwork} aria-label="Diagram showing a home server connected through Tailscale to personal devices and managed services">
      <div className="network-layer network-layer-back"><div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" /></div>
      <div className="network-layer network-layer-front">
        <div className="network-node server-node"><span className="node-icon"><Cpu /></span><div><strong>Home server</strong><small>tailhome.local</small></div><i className="online-dot" /></div>
        <div className="network-node tail-node"><span className="node-icon"><Network /></span><div><strong>Tailscale</strong><small>encrypted mesh</small></div></div>
        <div className="network-node device-node"><span className="node-icon"><Globe2 /></span><div><strong>Your devices</strong><small>anywhere</small></div></div>
        <div className="network-node cloud-node"><span className="node-icon"><Cloud /></span><div><strong>8 services</strong><small>managed locally</small></div></div>
      </div>
      <svg className="network-lines" viewBox="0 0 620 540" preserveAspectRatio="none" aria-hidden="true"><path d="M156 277 C220 277 220 270 287 270"/><path d="M380 270 C460 270 455 150 508 150"/><path d="M380 270 C455 270 456 396 510 396"/></svg>
      <div className="packet packet-one" /><div className="packet packet-two" /><p className="network-caption"><span /> secured by WireGuard®</p>
    </div>
  );
}
