import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";

const colors = {
  ink: "#07120f",
  surface: "#0d1c18",
  mint: "#6ee7b7",
  white: "#f8fbf9",
  muted: "#8fa49c",
  line: "rgba(255,255,255,.11)",
  blue: "#7dd3fc"
};

const mono = '"DejaVu Sans Mono", "Liberation Mono", monospace';
const sans = 'Inter, "DejaVu Sans", Arial, sans-serif';

export function InstallationFilm() {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [690, 719], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  return (
    <AbsoluteFill style={{ background: colors.ink, color: colors.white, fontFamily: sans, opacity: fadeOut }}>
      <Grid />
      <Header />
      <Sequence from={0} durationInFrames={100}><Opening /></Sequence>
      <Sequence from={80} durationInFrames={170}><CommandScene /></Sequence>
      <Sequence from={225} durationInFrames={215}><OnboardingScene /></Sequence>
      <Sequence from={415} durationInFrames={165}><InstallScene /></Sequence>
      <Sequence from={555} durationInFrames={165}><DashboardScene /></Sequence>
      <ProgressRail />
    </AbsoluteFill>
  );
}

function Grid() {
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
        backgroundSize: "64px 64px"
      }}
    />
  );
}

function Header() {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: "54px 68px auto", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 17 }}>
        <LogoMark />
        <div style={{ fontSize: 29, fontWeight: 800, letterSpacing: 0 }}>Tail<span style={{ color: colors.mint }}>Home</span></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 13, color: colors.muted, fontFamily: mono, fontSize: 18, textTransform: "uppercase" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors.mint, boxShadow: `0 0 18px ${colors.mint}` }} />
        Installation tour
        <span style={{ color: colors.white }}>{String(Math.floor(frame / 30)).padStart(2, "0")}s</span>
      </div>
    </div>
  );
}

function Opening() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 105 } });
  const exit = interpolate(frame, [72, 98], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", opacity: exit }}>
      <div style={{ textAlign: "center", transform: `translateY(${interpolate(enter, [0, 1], [36, 0])}px)`, opacity: enter }}>
        <p style={{ margin: 0, color: colors.mint, fontFamily: mono, fontSize: 21, fontWeight: 700, textTransform: "uppercase", letterSpacing: 3 }}>From a fresh Linux host</p>
        <h1 style={{ margin: "25px 0 0", fontSize: 83, lineHeight: 1.05, letterSpacing: 0, maxWidth: 1200 }}>Your private cloud.<br /><span style={{ color: colors.mint }}>One guided install.</span></h1>
      </div>
    </div>
  );
}

function CommandScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 0, 150);
  const command = "curl -fsSL https://tailhome.blackielabs.com/install.sh | bash";
  const typed = command.slice(0, Math.floor(interpolate(frame, [24, 88], [0, command.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

  return (
    <SceneShell opacity={opacity} step="01" label="Run one command" title="Start from any supported Linux host.">
      <Terminal title="blackie@homeserver: ~">
        <TerminalLine muted>Last login: today on pts/0</TerminalLine>
        <TerminalLine><Prompt />{typed}<Cursor visible={frame < 98 || Math.floor(frame / 12) % 2 === 0} /></TerminalLine>
        {frame > 100 ? <TerminalLine color={colors.blue}>Downloading the verified TailHome installer...</TerminalLine> : null}
        {frame > 124 ? <TerminalLine color={colors.mint}>✓ Bundle checksum verified</TerminalLine> : null}
      </Terminal>
    </SceneShell>
  );
}

function OnboardingScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 0, 195);
  const profiles = [
    ["Monitoring", "Grafana · Prometheus · Node Exporter"],
    ["Uptime", "Uptime Kuma"],
    ["Management", "Portainer"],
    ["DNS", "Pi-hole"]
  ];

  return (
    <SceneShell opacity={opacity} step="02" label="Choose your setup" title="Keep the defaults or shape the stack.">
      <div style={{ display: "grid", gridTemplateColumns: "1.08fr .92fr", minHeight: 585 }}>
        <Terminal title="TailHome onboarding" squareRight>
          <TerminalLine color={colors.mint} bold>TailHome 0.1</TerminalLine>
          <TerminalLine muted>System  Ubuntu 24.04 · x86_64</TerminalLine>
          <TerminalLine muted>Plan    Install to /opt/tailhome</TerminalLine>
          <Spacer />
          <PromptLine visible={frame > 18} text="Name this TailHome server" hint="tailhome" answer="homebase" />
          <PromptLine visible={frame > 48} text="Connect with Tailscale?" answer="Yes" />
          <PromptLine visible={frame > 78} text="Install Docker Compose?" answer="Yes" />
          <PromptLine visible={frame > 108} text="Start services after setup?" answer="Yes" />
        </Terminal>
        <div style={{ padding: "55px 50px", background: "#f5f7f3", color: colors.ink, borderRadius: "0 22px 22px 0" }}>
          <div style={{ color: "#547068", fontFamily: mono, fontSize: 17, fontWeight: 700, textTransform: "uppercase" }}>Service profiles</div>
          <h3 style={{ margin: "15px 0 32px", fontSize: 37, letterSpacing: 0 }}>What should run at home?</h3>
          <div style={{ display: "grid", gap: 14 }}>
            {profiles.map(([name, detail], index) => {
              const selected = frame > 42 + index * 28;
              return (
                <div key={name} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 16, alignItems: "center", padding: "15px 17px", border: `1px solid ${selected ? "#54b993" : "#d6dfdb"}`, background: selected ? "#e6f8ef" : "white", borderRadius: 9 }}>
                  <span style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 6, background: selected ? "#18815e" : "#e6ebe8", color: "white", fontWeight: 900 }}>{selected ? "✓" : ""}</span>
                  <span><strong style={{ display: "block", fontSize: 20 }}>{name}</strong><small style={{ color: "#5f746d", fontSize: 15 }}>{detail}</small></span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function InstallScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 0, 145);
  const tasks = [
    "Checking this server",
    "Setting up Tailscale",
    "Setting up Docker",
    "Checking service ports",
    "Creating the TailHome stack",
    "Finishing setup"
  ];
  const completeCount = Math.floor(interpolate(frame, [16, 118], [0, tasks.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <SceneShell opacity={opacity} step="03" label="Watch it come online" title="Every change stays visible.">
      <div style={{ padding: "54px 60px", minHeight: 585, background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 38 }}>
          <div><div style={{ fontFamily: mono, color: colors.muted, fontSize: 17 }}>INSTALLING TO /opt/tailhome</div><div style={{ marginTop: 12, fontSize: 31, fontWeight: 800 }}>TailHome service stack</div></div>
          <strong style={{ color: colors.mint, fontFamily: mono, fontSize: 22 }}>{Math.round(interpolate(frame, [10, 120], [4, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}%</strong>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 15 }}>
          {tasks.map((task, index) => {
            const done = index < completeCount;
            const active = index === completeCount;
            return (
              <div key={task} style={{ display: "flex", alignItems: "center", gap: 17, minHeight: 82, padding: "16px 20px", border: `1px solid ${done || active ? "rgba(110,231,183,.28)" : colors.line}`, borderRadius: 9, background: done ? "rgba(110,231,183,.07)" : "rgba(255,255,255,.025)" }}>
                <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 7, background: done ? colors.mint : active ? "rgba(110,231,183,.16)" : "rgba(255,255,255,.06)", color: done ? colors.ink : active ? colors.mint : colors.muted, fontWeight: 900 }}>{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
                <span><strong style={{ display: "block", fontSize: 19 }}>{task}</strong><small style={{ color: done ? colors.mint : colors.muted, fontFamily: mono, fontSize: 14 }}>{done ? "complete" : active ? "working..." : "queued"}</small></span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 34, height: 8, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}><div style={{ width: `${interpolate(frame, [10, 120], [4, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}%`, height: "100%", background: colors.mint }} /></div>
      </div>
    </SceneShell>
  );
}

function DashboardScene() {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, 0, 165);
  const enter = spring({ frame, fps: 30, config: { damping: 16, stiffness: 90 } });
  const zoom = interpolate(frame, [8, 160], [1, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1)
  });

  return (
    <SceneShell opacity={opacity} step="04" label="Open your dashboard" title="Your home services, ready anywhere.">
      <div style={{ height: 720, overflow: "hidden", borderRadius: 22, border: `1px solid ${colors.line}`, background: "#0b1220", boxShadow: "0 35px 95px rgba(0,0,0,.28)", transform: `scale(${interpolate(enter, [0, 1], [.97, 1])})` }}>
        <Img
          src={staticFile("videos/tailhome-dashboard.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center top",
            transform: `scale(${zoom})`,
            transformOrigin: "center top"
          }}
        />
      </div>
    </SceneShell>
  );
}

function SceneShell({ opacity, step, label, title, children }: { opacity: number; step: string; label: string; title: string; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", inset: "148px 68px 90px", opacity }}>
      <div style={{ display: "grid", gridTemplateColumns: "118px 1fr", alignItems: "end", marginBottom: 27 }}>
        <span style={{ color: colors.mint, fontFamily: mono, fontSize: 19, fontWeight: 700 }}>{step} / 04</span>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 30 }}>
          <h2 style={{ margin: 0, fontSize: 43, lineHeight: 1.08, letterSpacing: 0 }}>{title}</h2>
          <span style={{ color: colors.muted, fontFamily: mono, fontSize: 17, textTransform: "uppercase" }}>{label}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function Terminal({ title, squareRight = false, children }: { title: string; squareRight?: boolean; children: ReactNode }) {
  return (
    <div style={{ overflow: "hidden", minHeight: 585, border: `1px solid ${colors.line}`, borderRadius: squareRight ? "22px 0 0 22px" : 22, background: colors.surface, boxShadow: "0 35px 95px rgba(0,0,0,.28)" }}>
      <div style={{ height: 62, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 24px", borderBottom: `1px solid ${colors.line}`, background: "rgba(255,255,255,.025)" }}>
        <div style={{ display: "flex", gap: 9 }}><Dot color="#fb7185" /><Dot color="#fbbf24" /><Dot color={colors.mint} /></div>
        <span style={{ color: colors.muted, fontFamily: mono, fontSize: 15 }}>{title}</span>
        <span />
      </div>
      <div style={{ padding: "40px 48px", fontFamily: mono, fontSize: 27, lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

function TerminalLine({ children, color = colors.white, muted = false, bold = false }: { children: ReactNode; color?: string; muted?: boolean; bold?: boolean }) {
  return <div style={{ minHeight: 39, color: muted ? colors.muted : color, fontWeight: bold ? 700 : 400 }}>{children}</div>;
}

function PromptLine({ visible, text, answer, hint = "Y/n" }: { visible: boolean; text: string; answer: string; hint?: string }) {
  return visible ? <TerminalLine><span style={{ color: colors.mint }}>?</span> {text} <span style={{ color: colors.muted }}>[{hint}]</span>: <strong style={{ color: colors.mint }}>{answer}</strong></TerminalLine> : <TerminalLine>&nbsp;</TerminalLine>;
}

function Prompt() { return <span style={{ color: colors.mint }}>$ </span>; }
function Cursor({ visible }: { visible: boolean }) { return <span style={{ display: "inline-block", width: 11, height: 25, marginLeft: 3, verticalAlign: "-4px", background: visible ? colors.mint : "transparent" }} />; }
function Spacer() { return <div style={{ height: 22 }} />; }
function Dot({ color }: { color: string }) { return <span style={{ width: 11, height: 11, borderRadius: "50%", background: color }} />; }

function LogoMark() {
  return (
    <span style={{ display: "grid", width: 48, height: 48, placeItems: "center", borderRadius: 12, background: colors.mint, color: colors.ink }}>
      <svg width={31} height={31} viewBox="0 0 40 40" fill="none">
        <path d="M7 19.5 20 8l13 11.5V32a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V19.5Z" stroke="currentColor" strokeWidth="2.5" />
        <path d="M14 34V23h12v11M11 16.5h18" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="20" cy="18" r="2.5" fill="currentColor" />
      </svg>
    </span>
  );
}

function ProgressRail() {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, 719], [0, 100]);
  return (
    <div style={{ position: "absolute", left: 68, right: 68, bottom: 47, height: 3, background: "rgba(255,255,255,.1)", zIndex: 20 }}>
      <div style={{ width: `${progress}%`, height: "100%", background: colors.mint }} />
    </div>
  );
}

function sceneOpacity(frame: number, start: number, end: number) {
  return interpolate(frame, [start, start + 18, end - 22, end], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(.2, .7, 0, 1)
  });
}
