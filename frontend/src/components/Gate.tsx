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
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="w-80 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="font-serif text-lg text-stone-900">
          Personalized Health Team
        </h1>
        <p className="mt-1 text-xs text-stone-500">
          Enter the access password to continue.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
          placeholder="password"
          autoFocus
          className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
        />
        <button
          onClick={enter}
          className="mt-3 w-full rounded-md bg-stone-900 py-2 text-sm text-white hover:bg-stone-700"
        >
          Enter
        </button>
      </div>
    </div>
  );
}
