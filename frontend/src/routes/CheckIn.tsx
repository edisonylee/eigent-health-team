import { useState } from "react";
import { useAddCheckIn, useCheckIns } from "../lib/queries";
import { useStore } from "../store";

const SCALE = [1, 2, 3, 4, 5];

export default function CheckIn() {
  const password = useStore((s) => s.password);
  const { data: checkIns } = useCheckIns();
  const add = useAddCheckIn();
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<string>("");
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      await add.mutateAsync({
        password,
        energy: energy ?? undefined,
        sleep_hours: sleep ? parseFloat(sleep) : undefined,
        mood: mood ?? undefined,
        adherence_notes: notes || undefined,
      });
      setEnergy(null);
      setSleep("");
      setMood(null);
      setNotes("");
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 font-serif text-2xl text-stone-900">Daily check-in</h1>
        <p className="mb-5 text-sm text-stone-500">
          Log how you feel today. The Workforce can synthesize the last week
          into a follow-up plan adjustment.
        </p>

        <div className="space-y-5 rounded-lg border border-stone-200 bg-white p-5">
          <Scale
            label="Energy"
            value={energy}
            setValue={setEnergy}
            hint="1 = drained, 5 = great"
          />
          <Scale
            label="Mood"
            value={mood}
            setValue={setMood}
            hint="1 = low, 5 = bright"
          />
          <label className="block text-xs text-stone-600">
            Sleep (hours)
            <input
              type="number"
              step={0.25}
              min={0}
              max={16}
              value={sleep}
              onChange={(e) => setSleep(e.target.value)}
              className="mt-1 w-32 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-500"
            />
          </label>
          <label className="block text-xs text-stone-600">
            Adherence notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What stuck? What didn't? Any new symptoms?"
              className="mt-1 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={add.isPending}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-40"
          >
            {add.isPending ? "Saving…" : "Log check-in"}
          </button>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <h2 className="mb-2 mt-8 font-serif text-lg text-stone-900">
          Recent check-ins
        </h2>
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          {checkIns && checkIns.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left">Day</th>
                  <th className="px-3 py-2 text-right">Energy</th>
                  <th className="px-3 py-2 text-right">Sleep</th>
                  <th className="px-3 py-2 text-right">Mood</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((c) => (
                  <tr key={c.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 font-mono text-xs text-stone-700">
                      {c.day}
                    </td>
                    <td className="px-3 py-2 text-right">{c.energy ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{c.sleep_hours ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{c.mood ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-stone-600">
                      {c.adherence_notes || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-5 text-center text-xs text-stone-400">
              No check-ins yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Scale({
  label,
  value,
  setValue,
  hint,
}: {
  label: string;
  value: number | null;
  setValue: (v: number) => void;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-stone-600">
        <span>{label}</span>
        <span className="text-stone-400">{hint}</span>
      </div>
      <div className="mt-1 flex gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            className={
              "h-10 w-10 rounded-md border text-sm transition-colors " +
              (value === n
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50")
            }
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
