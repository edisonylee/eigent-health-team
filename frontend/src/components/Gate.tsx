import { useState } from "react";
import { useStore } from "../store";

/** Password gate. The password is verified server-side on the first run. */
export default function Gate() {
  const setPassword = useStore((s) => s.setPassword);
  const setAuthed = useStore((s) => s.setAuthed);
  const [pw, setPw] = useState("");

  const enter = () => {
    if (!pw) return;
    sessionStorage.setItem("est_pw", pw);
    setPassword(pw);
    setAuthed(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-midnight-eclipse">
      {/* Hero gradient — sits behind the centered card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-gradient-nebula opacity-60" />

      <div className="relative z-10 w-[360px] rounded-card bg-starless-night p-8 shadow-xl shadow-subtle-1">
        <div className="text-[10px] uppercase tracking-[0.2em] text-fuchsia-flare">
          HealthOS
        </div>
        <h1 className="mt-2 text-heading-sm font-semibold text-frost">
          Personalized Health Team
        </h1>
        <p className="mt-1 text-[13px] text-slate-gray">
          Enter the access password to continue.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
          placeholder="password"
          autoFocus
          className="mt-4 w-full rounded-default bg-frost/5 px-3 py-2 text-body text-frost placeholder:text-slate-gray outline-none transition-[box-shadow] focus:shadow-subtle-1"
        />
        <button
          onClick={enter}
          className="mt-3 w-full rounded-pill bg-electric-blue py-2 text-body font-medium text-frost transition hover:brightness-110"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
