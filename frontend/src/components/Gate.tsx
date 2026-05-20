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
    <div className="flex min-h-screen items-center justify-center bg-cloud-canvas px-6">
      <div className="w-[400px] rounded-card bg-paper-white p-8 shadow-card">
        <div className="flex items-center gap-2 text-caption uppercase tracking-[0.1px] text-slate-gray">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-fire-orange" />
          HealthOS
        </div>
        <h1 className="mt-2 text-heading font-medium text-ink-black">
          Personalized Health Team
        </h1>
        <p className="mt-1 text-body text-slate-gray">
          Enter the access password to continue.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
          placeholder="password"
          autoFocus
          className="mt-5 w-full rounded-input border border-cloud-canvas bg-elevated-white px-3 py-2 text-body text-ink-black placeholder:text-silver-mist outline-none transition-colors focus:border-ink-black"
        />
        <button
          onClick={enter}
          className="mt-3 w-full rounded-pill bg-fire-orange py-2.5 text-body font-medium text-white transition hover:brightness-110"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
