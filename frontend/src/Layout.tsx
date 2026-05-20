import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import CommandPalette from "./components/CommandPalette";
import Gate from "./components/Gate";
import OnboardingModal from "./components/OnboardingModal";
import { useModelStatus } from "./lib/queries";
import { useStore } from "./store";

const nav = [
  { to: "/", label: "Run" },
  { to: "/agents", label: "Agents" },
  { to: "/check-in", label: "Check-in" },
  { to: "/memory-graph", label: "Memory" },
  { to: "/evals", label: "Evals" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const authed = useStore((s) => s.authed);
  const { data: status } = useModelStatus();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!authed) return <Gate />;

  const onboardingNeeded =
    status !== undefined && status.has_usable_backend === false;

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
          <Link to="/" className="font-serif text-base text-stone-900">
            HealthOS
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  "rounded-md px-3 py-1.5 transition-colors " +
                  (isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900")
                }
              >
                {n.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="ml-2 rounded-md border border-stone-200 px-2 py-1 font-mono text-[11px] text-stone-500 hover:bg-stone-50"
              title="Command palette"
            >
              ⌘K
            </button>
          </nav>
          {status && (
            <div className="text-right font-mono text-[11px] text-stone-500">
              <div className="uppercase tracking-wide text-stone-400">backend</div>
              <div className="text-stone-700">
                {status.backend} · {status.model}
              </div>
            </div>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {onboardingNeeded && <OnboardingModal />}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNavigate={(path) => {
          setPaletteOpen(false);
          navigate(path);
        }}
      />
    </div>
  );
}
