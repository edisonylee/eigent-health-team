import { useState } from "react";
import { useNavigate } from "react-router-dom";

import CalendarStrip from "../components/CalendarStrip";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Textarea } from "../components/ui/Input";
import { cn } from "../lib/cn";
import { useAddCheckIn, useRuns } from "../lib/queries";
import { useStore } from "../store";

/** Today — the daily entry point for the longitudinal loop.
 *
 *  Two things, in this order:
 *    1. Log how you're feeling right now (check-in form).
 *    2. The calendar — every check-in (orange ring) and event (category dots)
 *       at a glance. Click any day for details or to add a note/event.
 *
 *  Everything here writes into accumulated state that the next Workforce
 *  run will consume.
 */

const SCALE = [1, 2, 3, 4, 5];

export default function Today() {
  const password = useStore((s) => s.password);
  const navigate = useNavigate();
  const { data: runs } = useRuns(1);

  const add = useAddCheckIn();
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<string>("");
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const hasPlan = (runs || []).some((r) => r.status === "done" && r.memo);

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

  const todayLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-silver-mist">
              {todayLabel}
            </div>
            <h1 className="mt-1 text-heading font-semibold text-ink-black">
              Today
            </h1>
            <p className="mt-1 text-body text-slate-gray">
              Log how you're feeling. Everything here feeds the next plan.
            </p>
          </div>
          {!hasPlan && (
            <Button size="sm" onClick={() => navigate("/plan")}>
              Start first plan →
            </Button>
          )}
        </header>

        <div className="space-y-5">
          <Card surface="starless" className="space-y-5">
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
            <label className="block text-[12px] text-slate-gray">
              Sleep (hours)
              <input
                type="number"
                step={0.25}
                min={0}
                max={16}
                value={sleep}
                onChange={(e) => setSleep(e.target.value)}
                className="mt-1 w-32 rounded-default bg-paper-white/5 px-3 py-1.5 text-body text-ink-black outline-none focus:shadow-subtle-1"
              />
            </label>
            <label className="block text-[12px] text-slate-gray">
              Adherence notes
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="What stuck? What didn't? Any new symptoms?"
                className="mt-1"
              />
            </label>
            <Button type="button" onClick={submit} disabled={add.isPending}>
              {add.isPending ? "Saving…" : "Log check-in"}
            </Button>
            {error && (
              <div className="rounded-default border border-status-error/30 bg-status-error/10 px-3 py-2 text-[12px] text-status-error">
                {error}
              </div>
            )}
          </Card>

          <section>
            <h2 className="mb-2 text-subheading font-medium text-ink-black">
              This month
            </h2>
            <CalendarStrip
              year={year}
              month={month}
              onChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
            />
          </section>
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
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-ink-black">{label}</span>
        <span className="text-silver-mist">{hint}</span>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            className={cn(
              "h-10 w-10 rounded-default border text-body transition-colors",
              value === n
                ? "border-fire-orange bg-fire-orange text-ink-black shadow-glow"
                : "border-frost-gray bg-paper-white/5 text-stone-gray hover:bg-paper-white/10",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
