import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, CheckIn as CheckInRow } from "../lib/api";
import { useAddCheckIn, useCheckIns, useRuns } from "../lib/queries";
import { useStore } from "../store";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Textarea } from "../components/ui/Input";
import { cn } from "../lib/cn";

const SCALE = [1, 2, 3, 4, 5];

export default function CheckIn() {
  const password = useStore((s) => s.password);
  const setTaskId = useStore((s) => s.setTaskId);
  const startFollowUp = useStore((s) => s.startFollowUp);
  const { data: checkIns } = useCheckIns();
  const { data: runs } = useRuns(10);
  const add = useAddCheckIn();
  const navigate = useNavigate();
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<string>("");
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [synthLoading, setSynthLoading] = useState(false);

  const lastDoneRun = runs?.find((r) => r.status === "done" && r.memo);
  const recentSeven = (checkIns || []).slice(0, 7);
  const canSynthesize = lastDoneRun && recentSeven.length > 0;

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

  const runWeeklySynthesis = async () => {
    if (!lastDoneRun) return;
    setError("");
    setSynthLoading(true);
    try {
      const note = buildSynthesisNote(recentSeven);
      const res = await api.run(lastDoneRun.task_id).catch(() => null);
      if (!res) throw new Error("source run not found");
      const followUp = await fetch(
        `/api/run/${lastDoneRun.task_id}/follow_up`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note, password }),
        },
      );
      if (!followUp.ok) {
        const body = await followUp.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${followUp.status}`);
      }
      const { task_id } = await followUp.json();
      setTaskId(task_id);
      startFollowUp();
      navigate("/");
    } catch (e) {
      setError(String(e));
    } finally {
      setSynthLoading(false);
    }
  };

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-heading font-semibold text-frost">
          Daily check-in
        </h1>
        <p className="mb-6 text-body text-slate-gray">
          Log how you feel today. The Workforce can synthesize the last week
          into a follow-up plan adjustment.
        </p>

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
              className="mt-1 w-32 rounded-default bg-frost/5 px-3 py-1.5 text-body text-frost outline-none focus:shadow-subtle-1"
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
            <div className="rounded-default border border-crimson-red/30 bg-crimson-red/10 px-3 py-2 text-[12px] text-crimson-red">
              {error}
            </div>
          )}
        </Card>

        <Card surface="starless" className="mt-6">
          <h2 className="text-subheading font-medium text-frost">
            Weekly synthesis
          </h2>
          <p className="mt-1 text-body text-slate-gray">
            Feed the last seven check-ins into a follow-up of your most recent
            plan. The Safety Reviewer + Plan Writer re-run with the new context
            (≈1/10th of a full run cost).
          </p>
          {!lastDoneRun && (
            <p className="mt-2 text-[12px] text-goldenrod">
              You need a completed plan first. Run one from{" "}
              <code className="rounded bg-frost/10 px-1 text-frost">/</code>.
            </p>
          )}
          {lastDoneRun && recentSeven.length === 0 && (
            <p className="mt-2 text-[12px] text-goldenrod">
              Log at least one check-in before running the synthesis.
            </p>
          )}
          <Button
            variant="ghost"
            type="button"
            onClick={runWeeklySynthesis}
            disabled={!canSynthesize || synthLoading}
            className="mt-3"
          >
            {synthLoading ? "Starting…" : "Run weekly synthesis"}
          </Button>
        </Card>

        <h2 className="mt-8 text-subheading font-medium text-frost">
          Recent check-ins
        </h2>
        <div className="mt-2 overflow-hidden rounded-card border border-twilight-ink bg-starless-night">
          {checkIns && checkIns.length > 0 ? (
            <table className="w-full text-body">
              <thead className="bg-midnight-eclipse/60 text-[10px] uppercase tracking-[0.2em] text-pewter">
                <tr>
                  <th className="px-4 py-2 text-left">Day</th>
                  <th className="px-4 py-2 text-right">Energy</th>
                  <th className="px-4 py-2 text-right">Sleep</th>
                  <th className="px-4 py-2 text-right">Mood</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.map((c) => (
                  <tr key={c.id} className="border-t border-twilight-ink">
                    <td className="px-4 py-2 font-mono text-[12px] text-ghostly-gray">
                      {c.day}
                    </td>
                    <td className="px-4 py-2 text-right text-frost">
                      {c.energy ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-frost">
                      {c.sleep_hours ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-frost">
                      {c.mood ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[12px] text-slate-gray">
                      {c.adherence_notes || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-6 text-center text-[12px] text-pewter">
              No check-ins yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildSynthesisNote(checkIns: CheckInRow[]): string {
  const rows = [...checkIns].reverse();
  const days = rows.length;
  const avg = (k: "energy" | "mood") => {
    const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };
  const sleeps = rows
    .map((r) => r.sleep_hours)
    .filter((v): v is number => typeof v === "number");
  const avgSleep =
    sleeps.length > 0
      ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1)
      : null;

  const lines: string[] = [
    `Weekly synthesis: ${days} check-in${days === 1 ? "" : "s"} over the last ${days} day${days === 1 ? "" : "s"}.`,
    "",
    `Averages: energy ${avg("energy") ?? "n/a"}/5, mood ${avg("mood") ?? "n/a"}/5, sleep ${avgSleep ?? "n/a"} h.`,
    "",
    "Day-by-day:",
  ];
  for (const r of rows) {
    const bits = [
      `${r.day}`,
      r.energy != null ? `energy ${r.energy}/5` : "",
      r.sleep_hours != null ? `${r.sleep_hours}h sleep` : "",
      r.mood != null ? `mood ${r.mood}/5` : "",
      r.adherence_notes ? `notes: ${r.adherence_notes}` : "",
    ].filter(Boolean);
    lines.push(`  - ${bits.join(" · ")}`);
  }
  lines.push("");
  lines.push(
    "Re-review the existing plan with this weekly context and adjust where the trend warrants.",
  );
  return lines.join("\n");
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
        <span className="text-frost">{label}</span>
        <span className="text-pewter">{hint}</span>
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
                ? "border-electric-blue bg-electric-blue text-frost shadow-glow"
                : "border-twilight-ink bg-frost/5 text-ghostly-gray hover:bg-frost/10",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
