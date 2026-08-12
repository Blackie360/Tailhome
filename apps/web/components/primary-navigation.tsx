"use client";

import { useEffect, useState } from "react";

const navigation = [
  { id: "stack", label: "The stack" },
  { id: "cli", label: "CLI" },
  { id: "install", label: "Install" },
  { id: "security", label: "Security" }
];

export function PrimaryNavigation() {
  const [activeSection, setActiveSection] = useState("top");

  useEffect(() => {
    const sections = ["top", ...navigation.map(({ id }) => id)]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-20% 0px -55%", threshold: [0, 0.15, 0.35, 0.6] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="hidden items-center gap-7 text-sm font-medium text-white/70 md:flex" aria-label="Primary navigation">
      {navigation.map(({ id, label }) => (
        <a
          className="nav-link"
          href={`#${id}`}
          key={id}
          aria-current={activeSection === id ? "location" : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
