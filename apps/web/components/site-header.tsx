"use client";

import { Github, Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Logo } from "@/components/logo";
import { primaryLinks } from "@/components/primary-navigation";

const observedIds = ["top", "walkthrough", "install", "stack", "cli", "security"];

export function SiteHeader() {
  const [activeSection, setActiveSection] = useState("top");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const sections = observedIds
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

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Logo />
        <nav className="primary-nav" aria-label="Primary navigation">
          {primaryLinks.map(({ id, label }) => (
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
        <div className="header-actions">
          <a className="header-github" href="https://github.com/Blackie360/Tailhome" aria-label="TailHome on GitHub">
            <Github className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a className="header-install" href="#install">
            Install
          </a>
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav className="mobile-nav" id={menuId} aria-label="Mobile">
          <div className="container">
            {primaryLinks.map(({ id, label }) => (
              <a
                href={`#${id}`}
                key={id}
                aria-current={activeSection === id ? "location" : undefined}
                onClick={closeMenu}
              >
                {label}
              </a>
            ))}
            <a href="#install" onClick={closeMenu}>
              Install
            </a>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
