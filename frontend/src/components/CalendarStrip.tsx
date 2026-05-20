// 4-week × 7-day calendar of logged events, with click-to-add retroactive
// logging. Sits above the TaskGraph on the home page. The 28-day window is
// shared with the TrendChart below so a click in either selects the same day.

import { useMemo, useState } from "react";
import { EVENT_CATEGORIES, EventCategory, LoggedEvent } from "../lib/api";
import {
  useDeleteEvent,
  useEvents,
  useLogEvent,
} from "../lib/queries";
import { useStore } from "../store";
import { Button } from "./ui/Button";
import { Dialog, DialogContent, DialogTitle } from "./ui/Dialog";
import { Input, Textarea } from "./ui/Input";

/** Tailwind class shortcuts per category. Same palette is used by TrendChart. */
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  symptom: "bg-crimson-red",
  meal: "bg-sunset-orange",
  sleep: "bg-sky-blue",
  exercise: "bg-vivid-green",
  supplement: "bg-teal-glow",
  medication: "bg-magenta-burst",
  mood: "bg-goldenrod",
  note: "bg-pewter",
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  symptom: "Symptom",
  meal: "Meal",
  sleep: "Sleep",
  exercise: "Exercise",
  supplement: "Supplement",
  medication: "Medication",
  mood: "Mood",
  note: "Note",
};

const WEEKS = 4;
const DAYS_PER_WEEK = 7;
const DAYS = WEEKS * DAYS_PER_WEEK;

/** Compute the [start, end] day strings for a 28-day window ending today. */
export function calendarWindow(now: Date = new Date()): {
  start: string;
  end: string;
  days: string[];
} {
  const days: string[] = [];
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Walk back DAYS-1 days; resulting array runs oldest -> newest.
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    days.push(formatDay(d));
  }
  return { start: days[0], end: days[days.length - 1], days };
}

export function formatDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarStrip() {
  const { start, end, days } = useMemo(() => calendarWindow(), []);
  const { data: events } = useEvents({ since: start, until: end, limit: 500 });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Bucket events by day for fast lookup.
  const byDay = useMemo(() => {
    const m = new Map<string, LoggedEvent[]>();
    for (const e of events || []) {
      const arr = m.get(e.day) || [];
      arr.push(e);
      m.set(e.day, arr);
    }
    return m;
  }, [events]);

  const today = formatDay(new Date());

  return (
    <div className="mb-5 rounded-card border border-twilight-ink bg-starless-night/60 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-gray">
            Calendar · last 28 days
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-pewter">
            {start} → {end}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedDay(today)}
          className="rounded-pill border border-ghostly-gray/40 bg-transparent px-3 py-1 text-[11px] text-frost hover:bg-frost/5"
        >
          + Log event
        </button>
      </div>

      {/* Day-of-week headers (Mon-Sun derived from the actual window). */}
      <div className="mb-1 grid grid-cols-7 gap-1 px-0.5 font-mono text-[9px] uppercase tracking-wider text-pewter">
        {days.slice(0, 7).map((d) => (
          <div key={d} className="text-center">
            {new Date(d + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "short",
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = byDay.get(day) || [];
          const isToday = day === today;
          const cats = uniqueCategories(dayEvents);
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={
                "group relative flex aspect-square flex-col items-stretch " +
                "justify-between rounded-default border p-1.5 text-left " +
                "transition-[background,border-color] " +
                (isToday
                  ? "border-electric-blue/60 bg-electric-blue/10 hover:bg-electric-blue/15"
                  : "border-twilight-ink bg-frost/[0.02] hover:bg-frost/5")
              }
              title={`${day} — ${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={
                    "font-mono text-[10px] " +
                    (isToday ? "text-frost" : "text-slate-gray")
                  }
                >
                  {parseInt(day.split("-")[2], 10)}
                </span>
                {dayEvents.length > 4 && (
                  <span className="font-mono text-[9px] text-pewter">
                    +{dayEvents.length - 4}
                  </span>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-0.5">
                {cats.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className={`h-1.5 w-1.5 rounded-full ${CATEGORY_COLOR[c]}`}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <DayEventsModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        events={selectedDay ? byDay.get(selectedDay) || [] : []}
      />
    </div>
  );
}

function uniqueCategories(events: LoggedEvent[]): EventCategory[] {
  const seen = new Set<EventCategory>();
  const order: EventCategory[] = [];
  for (const e of events) {
    if (!seen.has(e.category)) {
      seen.add(e.category);
      order.push(e.category);
    }
  }
  return order;
}

function DayEventsModal({
  day,
  events,
  onClose,
}: {
  day: string | null;
  events: LoggedEvent[];
  onClose: () => void;
}) {
  const password = useStore((s) => s.password);
  const log = useLogEvent();
  const del = useDeleteEvent();

  const [category, setCategory] = useState<EventCategory>("symptom");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [date, setDate] = useState<string>("");
  const [error, setError] = useState("");

  // Reset the form whenever the modal opens for a new day.
  const open = day != null;
  if (open && date !== day) {
    setDate(day!);
    setDescription("");
    setTags("");
    setError("");
  }

  const submit = async () => {
    if (!description.trim()) {
      setError("Add a description.");
      return;
    }
    setError("");
    try {
      await log.mutateAsync({
        password,
        category,
        description: description.trim(),
        day: date,
        tags: tags
          ? tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      });
      setDescription("");
      setTags("");
    } catch (e) {
      setError(String(e));
    }
  };

  const remove = async (id: number) => {
    try {
      await del.mutateAsync({ id, password });
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto p-6">
        <DialogTitle className="text-subheading font-semibold text-frost">
          {day ? prettyDay(day) : "Log event"}
        </DialogTitle>
        <p className="mt-0.5 text-[12px] text-slate-gray">
          {events.length === 0
            ? "Nothing logged yet."
            : `${events.length} event${events.length === 1 ? "" : "s"} on this day.`}
        </p>

        {events.length > 0 && (
          <ul className="mt-4 space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 rounded-default border border-twilight-ink bg-frost/[0.03] p-3"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CATEGORY_COLOR[e.category]}`}
                  title={e.category}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-wider text-pewter">
                    {CATEGORY_LABEL[e.category]}
                  </div>
                  <div className="mt-0.5 text-[13px] text-frost">
                    {e.description}
                  </div>
                  {e.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-pill bg-frost/5 px-2 py-0.5 font-mono text-[9px] text-ghostly-gray"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className="text-[10px] uppercase tracking-wider text-slate-gray hover:text-crimson-red"
                  title="Delete event"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 space-y-3 border-t border-twilight-ink pt-4">
          <div className="text-[10px] uppercase tracking-wider text-slate-gray">
            Add event
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-slate-gray">Date</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 font-mono text-[12px]"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-gray">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="mt-1 w-full rounded-default bg-frost/5 px-3 py-2 text-body text-frost outline-none focus:bg-frost/10 focus:shadow-subtle-1"
              >
                {EVENT_CATEGORIES.map((c) => (
                  <option
                    key={c}
                    value={c}
                    className="bg-starless-night text-frost"
                  >
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Textarea
            placeholder="What happened? e.g. 5 mile run, sharp lower-back twinge after sitting, took mag 200mg…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="text-[13px]"
          />

          <Input
            placeholder="Tags (optional, comma-separated): back, evening, mag-200"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="font-mono text-[11px]"
          />

          {error && (
            <div className="rounded-default border border-crimson-red/40 bg-crimson-red/10 px-3 py-2 text-[12px] text-crimson-red">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="subtle" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              onClick={submit}
              disabled={log.isPending || !description.trim()}
            >
              {log.isPending ? "Logging…" : "Log event"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function prettyDay(day: string): string {
  const d = new Date(day + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
