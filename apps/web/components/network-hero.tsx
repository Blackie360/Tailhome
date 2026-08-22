"use client";

import { Cloud, Cpu, Globe2, Network, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type RouteStop = {
  id: "server" | "tailnet" | "devices" | "services";
  className: string;
  icon: LucideIcon;
  label: string;
  meta: string;
  kicker: string;
  detail: string;
};

const routeStops: RouteStop[] = [
  {
    id: "server",
    className: "server-node",
    icon: Cpu,
    label: "Home server",
    meta: "tailhome.local",
    kicker: "01 / Origin",
    detail: "The request starts on hardware you own."
  },
  {
    id: "tailnet",
    className: "tail-node",
    icon: Network,
    label: "Tailscale",
    meta: "encrypted mesh",
    kicker: "02 / Private route",
    detail: "WireGuard carries it without opening your router."
  },
  {
    id: "devices",
    className: "device-node",
    icon: Globe2,
    label: "Your devices",
    meta: "anywhere",
    kicker: "03 / Arrival",
    detail: "Trusted devices reach home from wherever you are."
  },
  {
    id: "services",
    className: "cloud-node",
    icon: Cloud,
    label: "8 services",
    meta: "managed locally",
    kicker: "04 / Observe",
    detail: "Every service stays visible, healthy, and local."
  }
];

export function NetworkHero() {
  const frame = useRef<number>();
  const [autoPlay, setAutoPlay] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStop = routeStops[activeIndex];

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches || !autoPlay) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % routeStops.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [autoPlay]);

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

  function selectStop(index: number) {
    setAutoPlay(false);
    setActiveIndex(index);
  }

  return (
    <div
      className="network-canvas entrance-art"
      data-active={activeStop.id}
      onPointerMove={moveArtwork}
      onPointerLeave={resetArtwork}
      aria-label="Interactive diagram showing a private request traveling from a home server through Tailscale to personal devices and managed services"
    >
      <div className="network-layer network-layer-back"><div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" /></div>
      <div className="network-layer network-layer-front">
        {routeStops.map((stop, index) => {
          const Icon = stop.icon;
          return (
            <button
              className={`network-node ${stop.className} ${activeIndex === index ? "is-active" : ""}`}
              type="button"
              key={stop.id}
              onFocus={() => selectStop(index)}
              onPointerEnter={() => selectStop(index)}
              aria-pressed={activeIndex === index}
              aria-label={`${stop.label}: ${stop.detail}`}
            >
              <span className="node-icon"><Icon aria-hidden="true" /></span>
              <span><strong>{stop.label}</strong><small>{stop.meta}</small></span>
              {stop.id === "server" ? <i className="online-dot" /> : null}
            </button>
          );
        })}
      </div>
      <svg className="network-lines" viewBox="0 0 620 540" preserveAspectRatio="none" aria-hidden="true">
        <path className="route-line route-line-origin" d="M156 277 C220 277 220 270 287 270" />
        <path className="route-line route-line-device" d="M380 270 C460 270 455 150 508 150" />
        <path className="route-line route-line-services" d="M380 270 C455 270 456 396 510 396" />
        <circle className="network-signal" r="4"><animateMotion dur="3.4s" repeatCount="indefinite" path="M156 277 C220 277 220 270 287 270 C380 270 460 270 455 150 C475 150 492 150 508 150" /></circle>
        <circle className="network-signal network-signal-delayed" r="3"><animateMotion begin="1.7s" dur="3.4s" repeatCount="indefinite" path="M156 277 C220 277 220 270 287 270 C380 270 455 270 456 396 C475 396 492 396 510 396" /></circle>
      </svg>
      <div className="network-story" aria-hidden="true">
        <span className="network-story-index">0{activeIndex + 1}</span>
        <span className="network-story-copy"><small>{activeStop.kicker}</small><strong>{activeStop.detail}</strong></span>
        <span className="network-story-progress">
          {routeStops.map((stop, index) => <i className={index === activeIndex ? "is-active" : ""} key={stop.id} />)}
        </span>
      </div>
    </div>
  );
}
